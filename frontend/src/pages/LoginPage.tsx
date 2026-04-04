import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LogIn, UserPlus, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

type AuthMode = 'login' | 'signup';

const tempRoleAccounts = [
  {
    role: 'Analyst',
    identifier: 'analyst_aditya',
    email: 'aadityaa5000@gmail.com',
    password: '12345678',
    accent: 'var(--color-accent-purple)',
  },
  {
    role: 'Admin',
    identifier: 'admin_aditya',
    email: 'paisabanao.exe@gmail.com',
    password: '12345678',
    accent: 'var(--color-accent-blue)',
  },
  {
    role: 'NormalUser',
    identifier: 'normal_user_aditya',
    email: 'vadityateja458@gmail.com',
    password: '12345678',
    accent: 'var(--color-accent-amber)',
  },
] as const;

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, register, error: authError, clearError } = useAuth();

  const [mode, setMode] = useState<AuthMode>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const error = localError || authError || '';

  const clearMessages = () => {
    setLocalError('');
    setInfoMessage('');
    clearError();
  };

  const toggleMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    clearMessages();
  };

  const useTempAccount = (identifierValue: string, passwordValue: string) => {
    setIdentifier(identifierValue);
    setPassword(passwordValue);
    clearMessages();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    clearMessages();
    setLoading(true);

    if (mode === 'login') {
      const success = await login(identifier, password);
      setLoading(false);
      if (success) {
        navigate('/dashboard');
      }
      return;
    }

    if (signupPassword !== confirmPassword) {
      setLoading(false);
      setLocalError('Password confirmation does not match.');
      return;
    }

    if (signupPassword.length < 8) {
      setLoading(false);
      setLocalError('Password must be at least 8 characters.');
      return;
    }

    const result = await register({
      username,
      email,
      password: signupPassword,
      fullName,
    });

    setLoading(false);
    if (!result.success) {
      return;
    }

    if (result.requiresEmailConfirmation) {
      setInfoMessage('Account created. Please verify your email, then sign in.');
      setMode('login');
      setIdentifier(username || email);
      setPassword('');
      return;
    }

    navigate('/dashboard');
  };

  return (
    <div
      id="login-page"
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--color-bg-dark)',
        padding: '20px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          width: '600px',
          height: '600px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(79, 140, 255, 0.08) 0%, transparent 70%)',
          top: '-200px',
          right: '-100px',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: '500px',
          height: '500px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(124, 58, 237, 0.06) 0%, transparent 70%)',
          bottom: '-150px',
          left: '-100px',
          pointerEvents: 'none',
        }}
      />

      <div
        className="animate-fade-in"
        style={{
          width: '100%',
          maxWidth: '460px',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            marginBottom: '28px',
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 'var(--radius-lg)',
              background: 'linear-gradient(135deg, var(--color-accent-blue), #7c3aed)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '22px',
              fontWeight: 800,
              color: '#fff',
              boxShadow: '0 4px 20px rgba(79, 140, 255, 0.3)',
            }}
          >
            F
          </div>
          <span style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '-0.03em' }}>
            FinanceOS
          </span>
        </div>

        <div
          style={{
            backgroundColor: 'var(--color-bg-sidebar)',
            borderRadius: 'var(--radius-xl)',
            border: '1px solid var(--color-border-subtle)',
            padding: '34px 30px',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <h1
              style={{
                fontSize: '22px',
                fontWeight: 700,
                color: 'var(--color-text-primary)',
                marginBottom: '6px',
              }}
            >
              {mode === 'login' ? 'Welcome back' : 'Create your account'}
            </h1>
            <p style={{ fontSize: '14px', color: 'var(--color-text-muted)' }}>
              {mode === 'login'
                ? 'Sign in with your username or email'
                : 'Sign up with username and password'}
            </p>
          </div>

          <div
            style={{
              display: 'flex',
              gap: '4px',
              backgroundColor: 'var(--color-bg-card)',
              borderRadius: 'var(--radius-md)',
              padding: '4px',
              border: '1px solid var(--color-border-subtle)',
              marginBottom: '18px',
            }}
          >
            <button
              type="button"
              onClick={() => toggleMode('login')}
              style={{
                flex: 1,
                padding: '8px 10px',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: mode === 'login' ? 600 : 400,
                color: mode === 'login' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                backgroundColor: mode === 'login' ? 'var(--color-bg-card-hover)' : 'transparent',
              }}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => toggleMode('signup')}
              style={{
                flex: 1,
                padding: '8px 10px',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: mode === 'signup' ? 600 : 400,
                color: mode === 'signup' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                backgroundColor: mode === 'signup' ? 'var(--color-bg-card-hover)' : 'transparent',
              }}
            >
              Sign up
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            {mode === 'signup' && (
              <>
                <AuthField
                  id="signup-full-name"
                  label="Full name (optional)"
                  value={fullName}
                  onChange={setFullName}
                  placeholder="Aarav Sharma"
                  required={false}
                />
                <AuthField
                  id="signup-username"
                  label="Username"
                  value={username}
                  onChange={(value) => setUsername(value.toLowerCase())}
                  placeholder="aarav.sharma"
                />
                <AuthField
                  id="signup-email"
                  label="Email"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  placeholder="aarav@company.com"
                />
              </>
            )}

            {mode === 'login' && (
              <AuthField
                id="login-identifier"
                label="Username or email"
                value={identifier}
                onChange={setIdentifier}
                placeholder="username or email@company.com"
              />
            )}

            <PasswordField
              id={mode === 'login' ? 'login-password' : 'signup-password'}
              label="Password"
              value={mode === 'login' ? password : signupPassword}
              onChange={mode === 'login' ? setPassword : setSignupPassword}
              showPassword={showPassword}
              onToggle={() => setShowPassword((prev) => !prev)}
            />

            {mode === 'signup' && (
              <AuthField
                id="signup-confirm-password"
                label="Confirm password"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={setConfirmPassword}
                placeholder="Repeat your password"
              />
            )}

            {error && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-accent-red-soft)',
                  marginBottom: '16px',
                }}
              >
                <AlertCircle size={16} color="var(--color-accent-red)" />
                <span style={{ fontSize: '13px', color: 'var(--color-accent-red)' }}>{error}</span>
              </div>
            )}

            {infoMessage && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-accent-green-soft)',
                  marginBottom: '16px',
                }}
              >
                <CheckCircle2 size={16} color="var(--color-accent-green)" />
                <span style={{ fontSize: '13px', color: 'var(--color-accent-green)' }}>{infoMessage}</span>
              </div>
            )}

            <button
              id="auth-submit"
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '13px',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: 600,
                fontFamily: 'inherit',
                color: '#fff',
                background: loading
                  ? 'var(--color-text-muted)'
                  : 'linear-gradient(135deg, var(--color-accent-blue), #7c3aed)',
                boxShadow: '0 4px 16px rgba(79, 140, 255, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              {loading ? (
                <div
                  style={{
                    width: 18,
                    height: 18,
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTopColor: '#fff',
                    borderRadius: '50%',
                    animation: 'spin 0.7s linear infinite',
                  }}
                />
              ) : mode === 'login' ? (
                <>
                  <LogIn size={16} />
                  Sign in
                </>
              ) : (
                <>
                  <UserPlus size={16} />
                  Create account
                </>
              )}
            </button>

            {mode === 'login' && (
              <div
                style={{
                  marginTop: '14px',
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-subtle)',
                  backgroundColor: 'rgba(255,255,255,0.02)',
                }}
              >
                <p
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--color-text-secondary)',
                    marginBottom: '8px',
                  }}
                >
                  Temp mail IDs by role
                </p>

                <div style={{ display: 'grid', gap: '8px' }}>
                  {tempRoleAccounts.map((account) => (
                    <button
                      key={account.role}
                      type="button"
                      onClick={() => useTempAccount(account.identifier, account.password)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '9px 10px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--color-border-subtle)',
                        backgroundColor: 'var(--color-bg-card)',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        color: 'var(--color-text-primary)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = account.accent;
                        e.currentTarget.style.backgroundColor = 'var(--color-bg-card-hover)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--color-border-subtle)';
                        e.currentTarget.style.backgroundColor = 'var(--color-bg-card)';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: account.accent }}>{account.role}</span>
                        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>click to autofill</span>
                      </div>
                      <div style={{ marginTop: '4px', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                        {account.identifier}
                      </div>
                      <div style={{ marginTop: '2px', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                        {account.email}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </form>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

type AuthFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
  required?: boolean;
};

function AuthField({
  id,
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  required = true,
}: AuthFieldProps) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <label
        htmlFor={id}
        style={{
          display: 'block',
          fontSize: '13px',
          fontWeight: 500,
          color: 'var(--color-text-secondary)',
          marginBottom: '8px',
        }}
      >
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        style={{
          width: '100%',
          padding: '12px 14px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-border-subtle)',
          backgroundColor: 'var(--color-bg-card)',
          color: 'var(--color-text-primary)',
          fontSize: '14px',
          fontFamily: 'inherit',
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />
    </div>
  );
}

type PasswordFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  showPassword: boolean;
  onToggle: () => void;
};

function PasswordField({ id, label, value, onChange, showPassword, onToggle }: PasswordFieldProps) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <label
        htmlFor={id}
        style={{
          display: 'block',
          fontSize: '13px',
          fontWeight: 500,
          color: 'var(--color-text-secondary)',
          marginBottom: '8px',
        }}
      >
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <input
          id={id}
          type={showPassword ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter your password"
          required
          style={{
            width: '100%',
            padding: '12px 44px 12px 14px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border-subtle)',
            backgroundColor: 'var(--color-bg-card)',
            color: 'var(--color-text-primary)',
            fontSize: '14px',
            fontFamily: 'inherit',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
        <button
          type="button"
          onClick={onToggle}
          style={{
            position: 'absolute',
            right: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--color-text-muted)',
            padding: 0,
            display: 'flex',
          }}
        >
          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </div>
  );
}
