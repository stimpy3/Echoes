import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

/*
Shared chrome for the two auth forms: the logo + Log in / Create account row, the heading,
the Google slot, the OR rule, the fields and the legal line.

Two structural notes:

- The panel is a flex child, not `position: absolute`. The previous version anchored it with
  `absolute bottom-0` inside a container sized to the visual half, so any form taller than
  that container had its top pushed off-screen. Normal flow plus `overflow-y-auto` cannot do
  that, at any viewport size.
- It is dark-only, on the landing page's palette. Everything a logged-out visitor sees is one
  continuous dark surface.
*/

/* ------------------------------------------------------------------ field */

export const AuthField = ({
  label,
  name,
  type = 'text',
  value,
  onChange,
  placeholder,
  autoComplete,
  required = true,
  reveal = false,
}) => {
  const [shown, setShown] = useState(false);
  const isPassword = type === 'password';

  return (
    <label className="block">
      <span className="mb-1.5 block text-[12.5px] font-medium text-[#c9c7c3]">{label}</span>
      <div className="relative">
        <input
          type={isPassword && shown ? 'text' : type}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
          className={`h-[46px] w-full rounded-[10px] border border-[#242424] bg-[#131313] px-4
                      text-[14.5px] text-white placeholder:text-[#585858]
                      transition-colors duration-150 hover:border-[#2f2f2f] focus:border-[#3d3d3d]
                      focus:ring-1 focus:ring-accentMain/40 ${isPassword && reveal ? 'pr-[46px]' : ''}`}
        />
        {isPassword && reveal && (
          <button
            type="button"
            onClick={() => setShown((prev) => !prev)}
            aria-label={shown ? 'Hide password' : 'Show password'}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#6a6a6a] transition-colors hover:text-[#c9c7c3]"
          >
            {shown ? <Eye size={17} /> : <EyeOff size={17} />}
          </button>
        )}
      </div>
    </label>
  );
};

/* ------------------------------------------------------------------- tabs */

const AuthTabs = ({ mode, onSwitch }) => {
  const base = 'h-[30px] rounded-[7px] px-3 text-[12.5px] font-semibold transition-colors duration-150';
  return (
    <div className="flex items-center gap-1 rounded-[10px] border border-[#1e1e1e] bg-[#101010] p-1">
      <button
        type="button"
        onClick={mode === 'login' ? undefined : onSwitch}
        aria-current={mode === 'login'}
        className={`${base} ${mode === 'login' ? 'bg-white text-[#0b0b0b]' : 'text-[#9a9a9a] hover:text-white'}`}
      >
        Log in
      </button>
      <button
        type="button"
        onClick={mode === 'signup' ? undefined : onSwitch}
        aria-current={mode === 'signup'}
        className={`${base} ${mode === 'signup' ? 'bg-white text-[#0b0b0b]' : 'text-[#9a9a9a] hover:text-white'}`}
      >
        Create account
      </button>
    </div>
  );
};

/* ------------------------------------------------------------------ panel */

const AuthPanel = ({ mode, onSwitch, onSubmit, title, subtitle, googleSlot, children, submitLabel, loading }) => (
  /*
  Centring is done by the inner `min-h-full` flex wrapper, not by `items-center` on the
  scroll container. On a short viewport `align-items: center` pushes the overflow equally in
  both directions and scrollTop cannot go negative, so the top of the form — the logo and the
  tab switcher — becomes unreachable. min-h-full centres while the content is short and simply
  grows once it is not.
  */
  <div className="formDiv h-full flex-1 overflow-y-auto bg-[#0b0b0b] max-[900px]:h-auto max-[900px]:w-full">
    <div className="flex min-h-full items-center justify-center">
      <div className="w-full max-w-[440px] px-10 py-10 max-[900px]:px-6 max-[900px]:py-9">
      {/* No logo here — the mark sits next to the headline on the visual side. */}
      <div className="mb-7 flex items-center">
        <AuthTabs mode={mode} onSwitch={onSwitch} />
      </div>

      <h1 className="archivo text-[32px] leading-[1.08] tracking-[-.03em] text-white max-[900px]:text-[28px]">
        {title}
      </h1>
      <p className="mt-3 text-[14px] leading-[1.55] text-[#9a9a9a]">{subtitle}</p>

      {/* Outside the form: Google is its own auth path and must not submit the email form. */}
      <div className="mt-6">{googleSlot}</div>

      <div className="my-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-[#1e1e1e]" />
        <span className="text-[11px] font-semibold tracking-[.14em] text-[#5a5a5a]">OR</span>
        <div className="h-px flex-1 bg-[#1e1e1e]" />
      </div>

      <form onSubmit={onSubmit}>
        <div className="flex flex-col gap-4">{children}</div>

        <button
          type="submit"
          disabled={loading}
          className="mt-6 h-[46px] w-full rounded-[10px] bg-gradient-mainBright text-[15px] font-semibold text-white
                     transition-[filter] duration-150 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'One moment…' : submitLabel}
        </button>
      </form>

      {/*
      Plain text, not links: this app has no Terms or Privacy routes, and pointing at pages
      that do not exist is worse than not linking at all. Wire these up if those pages ship.
      */}
        <p className="mt-5 text-[11.5px] leading-[1.55] text-[#585858]">
          By continuing you agree to the Echoes Terms and Privacy Policy.
        </p>
      </div>
    </div>
  </div>
);

export default AuthPanel;
