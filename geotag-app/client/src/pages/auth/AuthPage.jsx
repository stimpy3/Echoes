import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Login from './Login';
import Signup from './Signup';


const AuthPage = () => {
  const [searchParams] = useSearchParams();
  /*
  Seeded from the query string so the landing page's "Create account" button
  (/auth?mode=signup) opens the signup form directly. Read once as initial state
  rather than derived on every render — after the first paint the user's own
  switching is the source of truth, not the URL.
  */
  const [showLogin, setShowLogin] = useState(searchParams.get('mode') !== 'signup');

  return (
      <div className="w-full h-full">
        {showLogin ? (
          <Login onSwitchToSignup={() => setShowLogin(false)} />
        ) : (
          <Signup onSwitchToLogin={() => setShowLogin(true)} />
        )}
      </div>

  );
};

export default AuthPage;
