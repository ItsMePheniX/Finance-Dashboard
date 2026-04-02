package services

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"net/http"
	"strings"
	"sync"
	"time"

	"finance-dashboard/backend/internal/config"

	"github.com/golang-jwt/jwt/v5"
)

type jwkSet struct {
	Keys []jwkKey `json:"keys"`
}

type jwkKey struct {
	Kty string `json:"kty"`
	Kid string `json:"kid"`
	Use string `json:"use"`
	Alg string `json:"alg"`
	N   string `json:"n"`
	E   string `json:"e"`
	Crv string `json:"crv"`
	X   string `json:"x"`
	Y   string `json:"y"`
}

type SupabaseJWTVerifier struct {
	cfg       config.Config
	http      *http.Client
	mu        sync.RWMutex
	keys      map[string]any
	expiresAt time.Time
}

func NewSupabaseJWTVerifier(cfg config.Config) *SupabaseJWTVerifier {
	return &SupabaseJWTVerifier{
		cfg:  cfg,
		http: &http.Client{Timeout: 10 * time.Second},
		keys: make(map[string]any),
	}
}

func (v *SupabaseJWTVerifier) ValidateAccessToken(tokenString string) (jwt.MapClaims, error) {
	if err := v.ensureKeys(); err != nil {
		return nil, err
	}

	claims := jwt.MapClaims{}
	issuer := strings.TrimRight(v.cfg.SupabaseURL, "/") + "/auth/v1"
	parsedToken, err := jwt.ParseWithClaims(
		tokenString,
		claims,
		v.keyfunc,
		jwt.WithValidMethods([]string{"RS256", "ES256"}),
		jwt.WithIssuer(issuer),
	)
	if err != nil {
		return nil, err
	}
	if !parsedToken.Valid {
		return nil, errors.New("invalid access token")
	}

	if aud := v.cfg.SupabaseJWTAudience; aud != "" {
		if !containsAudience(claims, aud) {
			return nil, errors.New("invalid audience")
		}
	}

	return claims, nil
}

func (v *SupabaseJWTVerifier) keyfunc(token *jwt.Token) (any, error) {
	kid, _ := token.Header["kid"].(string)
	if kid == "" {
		return nil, errors.New("missing kid header")
	}

	v.mu.RLock()
	key := v.keys[kid]
	v.mu.RUnlock()
	if key == nil {
		if err := v.refreshKeys(); err != nil {
			return nil, err
		}
		v.mu.RLock()
		key = v.keys[kid]
		v.mu.RUnlock()
	}
	if key == nil {
		return nil, fmt.Errorf("signing key not found for kid %s", kid)
	}

	return key, nil
}

func (v *SupabaseJWTVerifier) ensureKeys() error {
	v.mu.RLock()
	fresh := time.Now().Before(v.expiresAt) && len(v.keys) > 0
	v.mu.RUnlock()
	if fresh {
		return nil
	}
	return v.refreshKeys()
}

func (v *SupabaseJWTVerifier) refreshKeys() error {
	endpoint := strings.TrimRight(v.cfg.SupabaseURL, "/") + "/auth/v1/.well-known/jwks.json"
	resp, err := v.http.Get(endpoint)
	if err != nil {
		return fmt.Errorf("failed to fetch jwks: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("jwks endpoint returned %d", resp.StatusCode)
	}

	var set jwkSet
	if err := json.NewDecoder(resp.Body).Decode(&set); err != nil {
		return fmt.Errorf("failed to decode jwks: %w", err)
	}

	newKeys := make(map[string]any)
	for _, key := range set.Keys {
		switch key.Kty {
		case "RSA":
			if key.Kid == "" || key.N == "" || key.E == "" {
				continue
			}
			pub, err := parseRSAPublicKeyFromJWK(key.N, key.E)
			if err != nil {
				continue
			}
			newKeys[key.Kid] = pub
		case "EC":
			if key.Kid == "" || key.Crv == "" || key.X == "" || key.Y == "" {
				continue
			}
			pub, err := parseECDSAPublicKeyFromJWK(key.Crv, key.X, key.Y)
			if err != nil {
				continue
			}
			newKeys[key.Kid] = pub
		}
	}
	if len(newKeys) == 0 {
		return errors.New("no valid keys in jwks")
	}

	v.mu.Lock()
	v.keys = newKeys
	v.expiresAt = time.Now().Add(10 * time.Minute)
	v.mu.Unlock()
	return nil
}

func parseRSAPublicKeyFromJWK(nB64 string, eB64 string) (*rsa.PublicKey, error) {
	nBytes, err := base64.RawURLEncoding.DecodeString(nB64)
	if err != nil {
		return nil, err
	}
	eBytes, err := base64.RawURLEncoding.DecodeString(eB64)
	if err != nil {
		return nil, err
	}

	n := new(big.Int).SetBytes(nBytes)
	e := new(big.Int).SetBytes(eBytes).Int64()
	if n.Sign() <= 0 || e <= 0 {
		return nil, errors.New("invalid rsa values")
	}

	return &rsa.PublicKey{N: n, E: int(e)}, nil
}

func parseECDSAPublicKeyFromJWK(crv string, xB64 string, yB64 string) (*ecdsa.PublicKey, error) {
	xBytes, err := base64.RawURLEncoding.DecodeString(xB64)
	if err != nil {
		return nil, err
	}
	yBytes, err := base64.RawURLEncoding.DecodeString(yB64)
	if err != nil {
		return nil, err
	}

	var curve elliptic.Curve
	switch crv {
	case "P-256":
		curve = elliptic.P256()
	default:
		return nil, fmt.Errorf("unsupported ec curve: %s", crv)
	}

	x := new(big.Int).SetBytes(xBytes)
	y := new(big.Int).SetBytes(yBytes)
	if !curve.IsOnCurve(x, y) {
		return nil, errors.New("invalid ec point")
	}

	return &ecdsa.PublicKey{Curve: curve, X: x, Y: y}, nil
}

func containsAudience(claims jwt.MapClaims, expected string) bool {
	audiences, err := claims.GetAudience()
	if err != nil {
		return false
	}
	for _, aud := range audiences {
		if aud == expected {
			return true
		}
	}
	return false
}
