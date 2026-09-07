import { X } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import BareHomePage from '../BarebonesPages/BareHomePage';
import AuthVisual from '../../components/Auth/AuthVisual';
import AuthPanel, { AuthField } from '../../components/Auth/AuthPanel';
import { setCsrfToken } from '../../utils/csrf';
import '../../styles/auth.css';

const Login = ({ onSwitchToSignup }) => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // false until Google's script has actually rendered its button into #googleBtn
  const [googleReady, setGoogleReady] = useState(false);
  const googleWrapRef = useRef(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    if (error) setError('');
  };

  const BASE_URL = import.meta.env.VITE_BASE_URL || 'http://localhost:5000';

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      if (!formData.email || !formData.password) {
        setError('All fields are required');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');

      const response = await axios.post(
        `${BASE_URL}/api/auth/login`,
        {
          email: formData.email,
          password: formData.password,
        },
        { withCredentials: true }
      );

      setCsrfToken(response.data.csrfToken);
      setFormData({ email: '', password: '' });
      navigate('/home');
    } catch (err) {
      console.error('Login error:', err);
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCredentialResponse = async (response) => {
    setLoading(true);

    try {
      const res = await axios.post(
        `${BASE_URL}/api/auth/google`,
        { token: response.credential },
        { withCredentials: true } // very important! for cookies
      );

      setCsrfToken(res.data.csrfToken);

      if (res.data.isNewUser) {
        navigate('/homelocation'); // redirect new users
      } else {
        navigate('/home'); // redirect existing users
      }
    } catch (err) {
      console.error('Google login failed:', err.response?.data || err);
      setError('Google sign-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  /*
  window.google may not be ready when this first runs, especially after a refresh or a fast
  route switch — that is why the button used to disappear sometimes. Retry until it is.
  */
  useEffect(() => {
    let cancelled = false;
    let retryId;

    const initializeGoogleButton = () => {
      if (cancelled) return;

      if (window.google && document.getElementById('googleBtn')) {
        window.google.accounts.id.initialize({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
          callback: handleCredentialResponse,
        });

        // width must be a pixel NUMBER — GIS ignores strings like "100%" — and it
        // hard-caps at 400, so measuring a wider wrapper would just get clamped anyway.
        const wrapWidth = googleWrapRef.current?.offsetWidth || 400;
        const buttonWidth = Math.min(400, Math.max(200, Math.round(wrapWidth)));
        // 400 is GIS's hard cap; auth.css stretches the rendered result the rest of the way.

        window.google.accounts.id.renderButton(document.getElementById('googleBtn'), {
          // Theme is immaterial: this button is rendered at zero opacity over our own.
          theme: 'filled_black',
          size: 'large',
          text: 'continue_with',
          shape: 'rectangular',
          width: buttonWidth,
          // GIS defaults to "left": icon pinned to the edge, label centered across the FULL
          // width — that's what was stranding them apart on a wide button. "center" groups
          // icon+label as one block and centers that block instead.
          logo_alignment: 'center',
        });

        setGoogleReady(true);
      } else {
        retryId = setTimeout(initializeGoogleButton, 300);
      }
    };

    initializeGoogleButton();

    // stop the retry loop if the user navigates away mid-wait
    return () => {
      cancelled = true;
      clearTimeout(retryId);
    };
  }, []);

  /*
  Google's script renders the real button into #googleBtn, which can take a moment. Until it
  does, #googleBtn is `invisible` (visibility:hidden — it still occupies its box, so the width
  measurement above stays correct) and the placeholder shows in its place. They are never both
  visible at once: a translucent overlay sitting on a live button reads as flickering.
  */
  const googleSlot = (
    <div ref={googleWrapRef} className="echoes-google-slot group relative h-[46px] w-full">
      {/*
      The visible button. Presentational only — the real GIS button is laid over it at zero
      opacity (see auth.css) and takes the click, so this can be styled to match the inputs
      instead of inheriting Google's own chrome. Dimmed until GIS has actually rendered,
      because until then there is nothing on top to click.
      */}
      <div
        aria-hidden="true"
        className={`pointer-events-none flex h-full w-full items-center justify-center gap-3 rounded-[10px]
                    border border-[#242424] bg-[#131313] transition-colors duration-150
                    ${googleReady ? 'text-white group-hover:border-[#2f2f2f] group-hover:bg-[#171717]' : 'text-[#585858]'}`}
      >
        <svg width="18" height="18" viewBox="0 0 48 48" className="shrink-0">
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
        </svg>
        <span className="text-[14.5px] font-medium">Continue with Google</span>
      </div>

      <div id="googleBtn" className={googleReady ? 'cursor-pointer' : 'pointer-events-none'} />
    </div>
  );

  if (loading) {
    // bare bones of the home page as a placeholder while loading
    return <BareHomePage />;
  }

  return (
    <div className="relative flex h-[100vh] w-full overflow-hidden bg-[#0b0b0b] max-[900px]:h-auto max-[900px]:min-h-[100vh] max-[900px]:flex-col max-[900px]:overflow-visible">
      {error && (
        <div className="absolute left-[50%] top-[20px] z-[50] flex -translate-x-1/2 items-center rounded-md border-[1px] border-red-500 bg-red-500/30 p-[10px] text-white backdrop-blur-md">
          {error}
          <button className="pl-[5px] text-red-600" onClick={() => setError('')} aria-label="Dismiss">
            <X />
          </button>
        </div>
      )}

      <AuthVisual />

      <AuthPanel
        mode="login"
        onSwitch={onSwitchToSignup}
        onSubmit={handleSubmit}
        title="Welcome back."
        subtitle="Your pins, trips and timeline are where you left them. Sign in and pick the map back up."
        googleSlot={googleSlot}
        submitLabel="Log in"
        loading={loading}
      >
        <AuthField
          label="Email"
          name="email"
          type="email"
          value={formData.email}
          onChange={handleChange}
          placeholder="you@example.com"
          autoComplete="email"
        />
        <AuthField
          label="Password"
          name="password"
          type="password"
          value={formData.password}
          onChange={handleChange}
          placeholder="Your password"
          autoComplete="current-password"
          reveal
        />
      </AuthPanel>
    </div>
  );
};

export default Login;
