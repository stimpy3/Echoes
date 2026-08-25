import { EyeOff, Eye,X } from 'lucide-react';
import { useState,useEffect, useRef,useMemo,useCallback } from 'react';
import Lottie from "lottie-react";
import animationData from "../../data/animationData/startingAnimation.json";
import SplitText from "../../components/Layout/SplitText";
import LightRays from '../../components/Layout/LightRays';
import axios from "axios";
import { useNavigate } from 'react-router-dom';
import { gsap } from 'gsap';
import BareHomePage from '../BarebonesPages/BareHomePage';
import { setCsrfToken } from '../../utils/csrf';

const Signup = ({ onSwitchToLogin }) => {

  const navigate = useNavigate();

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  //false until Google's script has actually rendered its button into #googleBtn
  const [googleReady, setGoogleReady] = useState(false);
  const googleWrapRef = useRef(null);
  const [formData, setFormData] = useState({ 
    name: '',
    email: '',
    password: '',
  });


  const handleChange = (e) => { //runs on every input change

    setFormData({
      ...formData,
      [e.target.name]: e.target.value
      /*
      e is event object
      e.target is the input element that triggered the event
      e.target.name is the name attribute of that input element
      e.target.value is the current value of that input element
      ...formData copies all the existing fields in the form state.
      [e.target.name]: e.target.value updates only the field that changed.
      why in []?
      [key] tells JavaScript: “Use the value of this variable as the key
      Without the brackets, this would literally create a key called "e.target.name" instead of "email" or "password".
       */
    });
    if (error) setError('');
    if (success) setSuccess('');

  };
  
   const BASE_URL=import.meta.env.VITE_BASE_URL || "http://localhost:5000";


  const handleSubmit = async (e) => {
    e.preventDefault();
    /*
    You click the Submit button.
    Browser does its default form behavior:
    Packages the form data into a request.
    Navigates away from the current page (reloads the page) to send that request.
    
    In a React SPA:
    Page reload = React state lost, your current view is destroyed and rebuilt.
    Any ongoing animations, data in memory, or UI state is lost.
    Clicking Submit does not reload the page.
    
    React stays in control of the page.
    You can handle the data manually:
    axios.post("/api/auth/signup", formData);
    Page stays in the same place, keeping your state, animations, and SPA flow intact.
     */

    // Basic validation

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

      try {
      setLoading(true);
      setError('');
      setSuccess('');
      
      //Using /api clearly marks routes as API endpoints.
      //Without it, /signup could conflict with a React frontend route /signup
      //axios is a popular library for making HTTP requests.
      const response = await axios.post(`${BASE_URL}/api/auth/signup`, {
        name: formData.name,
        email: formData.email,
        password: formData.password,
      },{ withCredentials: true});//{ withCredentials: true} tells it’s okay to include cookies from 5000 when requests come from 3000.
      //tells browser to actually send/receive cookies

      //Data object is the {} part
      //This is the request body sent to your backend.
      /*     
      response.data → The data sent by the server
      response.status → HTTP status code (e.g., 200, 400, 500).
      response.statusText → Status message (e.g., “OK”, “Bad Request”)
      response.headers → Headers sent by the server.
      response.config → The Axios request configuration used.
       */

      setCsrfToken(response.data.csrfToken);
      setSuccess('Account created successfully!');
      setFormData({ name: '', email: '', password: ''});//reset
      navigate('/homelocation');//redirect to set home location

    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Something went wrong!');
    } finally {
      setLoading(false);
    }
  
  };


  const pinsRef = useRef([]);

  useEffect(() => {
    let ctx = gsap.context(() => {
      const validPins = pinsRef.current.filter(Boolean);
      if (validPins.length === 0) return;

      gsap.fromTo(
        validPins,
        { opacity: 0, y: 50, scale: 0 },
        {
          delay: 0.5,
          opacity: 1,
          y: 0,
          scale: (i, el) => parseFloat(el.getAttribute('data-scale') || '1'),
          duration: 0.8,
          stagger: 0.2,
          ease: 'power3.out',
        }
      );
    });
    return () => ctx.revert();
  }, []);

  const fromProps = useMemo(() => ({ opacity: 0, y: 40 }), []);
const toProps = useMemo(() => ({ opacity: 1, y: 0 }), []);

const handleAnimationComplete = useCallback(() => {
  console.log("Animation finished!");
}, []);

/*The problem is that window.google might not be ready yet when your useEffect first runs
especially after a refresh or fast route switch.
That’s why the Google button sometimes disappears.  thats why the setTimeout*/
  useEffect(() => {
  let cancelled = false;
  let retryId;

  const initializeGoogleButton = () => {
    if (cancelled) return;

    if (window.google && document.getElementById("googleBtn")) {
      google.accounts.id.initialize({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse,
      });

      //width must be a pixel NUMBER — GIS ignores strings like "100%" — and it
      //hard-caps at 400, so measuring a wider wrapper would just get clamped anyway.
      const wrapWidth = googleWrapRef.current?.offsetWidth || 400;
      const buttonWidth = Math.min(400, Math.max(200, Math.round(wrapWidth)));

      google.accounts.id.renderButton(
        document.getElementById("googleBtn"),
        {
          theme: "outline",
          size: "large",
          text: "continue_with",
          shape: "rectangular",
          width: buttonWidth,
          //GIS defaults to "left": icon pinned to the edge, label centered across
          //the FULL width — that's what was stranding them apart on a wide button.
          //"center" groups icon+label as one block and centers that block instead.
          logo_alignment: "center",
        }
      );

      //the real button now exists, so the placeholder can step aside
      setGoogleReady(true);
    } else {
      // Retry after a short delay if google object isn’t loaded yet
      retryId = setTimeout(initializeGoogleButton, 300);
    }
  };

  initializeGoogleButton();

  //stop the retry loop if the user navigates away mid-wait
  return () => {
    cancelled = true;
    clearTimeout(retryId);
  };
}, []);


 const handleCredentialResponse = async (response) => {
  setLoading(true); // start loading before API call

  try {
    const res = await axios.post(
      `${BASE_URL}/api/auth/google`,
      { token: response.credential },
      { withCredentials: true } // needed for cookies
    );

    // console.log("Google login success:", res.data);
    setCsrfToken(res.data.csrfToken);

    if (res.data.isNewUser) {
      navigate("/homelocation"); // redirect new users
    } else {
      navigate("/home"); // redirect existing users
    }
  } catch (err) {
    console.error("Google login failed:", err.response?.data || err);
  } finally {
    setLoading(false); // stop loading regardless of success/failure
  }
};


  return (
    loading?
    //bare bones of home page nav bar as placeholder while loading
   <BareHomePage/>
      :
    <div className="min-h-[100vh] w-[100vw] relative flex max-[550px]:max-h-fit max-[550px]:flex-col items-center bg-dlightMain">
      {(error)?
      <div className='flex items-center text-white bg-red-500/30 backdrop-blur-md absolute z-[50] top-[20px] left-[50%] -translate-x-1/2 p-[10px] rounded-md border-[1px] border-red-500'>
        {error}
        <button className='pl-[5px] text-red-600' onClick={()=>setError(prev => !prev)}><X></X></button>
      </div>:
      <div className='display-none'></div>
      }
      
      <div className="visualDiv relative flex justify-start items-center w-[50%] max-[550px]:w-[100%] h-full max-[550px]:h-[55vh] transparent overflow-hidden">
        {/* <Lottie animationData={animationData} loop={true} className="w-[50%] aspect-square overflow-hidden"/>; */}
           <LightRays
            raysOrigin="top-center"
            raysColor="#ffffffff"
            raysSpeed={1}
            lightSpread={0.8}
            rayLength={3}
            followMouse={true}
            mouseInfluence={false}
            noiseAmount={0.05}
            distortion={0.05}
            className="custom-rays"
          />
          <div datalabel="logo" className="absolute top-[20px] max-[550px]:w-0 left-[20px] w-[40px] h-[40px] bg-[url('/logo.png')] bg-contain bg-center bg-no-repeat"></div>
          <SplitText
           text="Moments Made Timeless"
           className="absolute z-[10] top-[20%] max-[550px]:top-[10%] left-1/2 -translate-x-1/2 text-6xl  max-[640px]:text-5xl font-bold mb-2 text-dtxt"
           delay={0.1}
           duration={1.0}
           ease="power3.out"
           splitType="chars"
           from={fromProps}
           to={toProps}
           threshold={0.1}
           rootMargin="-100px"
           textAlign="center"
           onLetterAnimationComplete={handleAnimationComplete}
         />

            <>
              <div
                ref={el => (pinsRef.current[0] = el)}
                datalabel='pinMiddle'
                data-scale="1.2"
                className="scale-[1.2]  max-[550px]:bottom-[10%] max-[640px]:scale-[1] absolute bottom-[40px] left-1/2 -translate-x-1/2 h-[85px] w-[70px]"
              >
                <div datalabel='pinbody' className="relative w-full p-[5px] rounded-md aspect-square bg-white">
                  <div
                    datalabel='pinImage'
                    className="bg-cover bg-[url(/BandraBandStandWalk.jpg)] h-[60px] relative z-[5] aspect-square rounded-sm bg-gray-400"
                  ></div>
                </div>
                <div datalabel='pintip' className='w-[20px] absolute left-1/2 -translate-x-1/2 bottom-[5px] aspect-square bg-white rotate-45'></div>
              </div>
        
              <div
                ref={el => (pinsRef.current[1] = el)}
                datalabel='pinLeft'
                data-scale="0.9"
                className="scale-[0.9] max-[550px]:bottom-[20%] max-[640px]:scale-[0.8] absolute bottom-[100px] max-[740px]:bottom-[150px]  left-[15%] max-[740px]:left-[10%] h-[85px] w-[70px]"
              >
                <div datalabel='pinbody' className="relative w-full p-[5px] rounded-md aspect-square bg-white">
                  <div
                    datalabel='pinImage'
                    className="bg-cover bg-[url(/GatewayOfInDIA.jpg)] h-[60px] relative z-[5] aspect-square rounded-sm bg-gray-400"
                  ></div>
                </div>
                <div datalabel='pintip' className='w-[20px] absolute left-1/2 -translate-x-1/2 bottom-[5px] aspect-square bg-white rotate-45'></div>
              </div>
        
              <div
                ref={el => (pinsRef.current[2] = el)}
                datalabel='pinRight'
                data-scale="0.7"
                className="scale-[0.7]  max-[550px]:bottom-[25%] max-[640px]:scale-[0.5] absolute bottom-[150px]  max-[740px]:bottom-[200px] right-[15%] max-[740px]:right-[5%] h-[85px] w-[70px]"
              >
                <div datalabel='pinbody' className="relative w-full p-[5px] rounded-md aspect-square bg-white">
                  <div
                    datalabel='pinImage'
                    className="bg-cover bg-[url(/sanjay-gandhi-national-park.webp)] h-[60px] relative z-[5] aspect-square rounded-sm bg-gray-400"
                  ></div>
                </div>
                <div datalabel='pintip' className='w-[20px] absolute left-1/2 -translate-x-1/2 bottom-[5px] aspect-square bg-white rotate-45'></div>
              </div>
           </>

        <div className="w-full bg-[#1f1f1f] h-full bg-[url('/grid.png')] bg-cover bg-no-repeat"></div>
      </div>
      <div className='w-0 h-[63vh]'></div>
      <div className="formDiv text-txt flex justify-center items-center absolute z-10 h-full min-h-[50%] max-[550px]:h-fit w-[50%] max-[550px]:w-[100%] bottom-0  right-0 bg-main shadow-lg rounded-l-[30px]  max-[550px]:rounded-bl-none max-[550px]:rounded-t-[30px]">
        <form
          onSubmit={handleSubmit}
          className="p-[30px] px-[50px] max-h-[600px] justify-around max-[550px]:py-[10px] w-full h-full flex flex-col"
        >
           <div className="h-fit w-full">
             <p className="text-[2rem] max-[640px]:text-[1.8rem] h-fit max-[550px]:my-[10px] max-[550px]:text-center text-txt font-semibold mb-[20px]">Create Account</p>
           </div>

          <div className="h-fit w-full">
          {/* Name */}
          <div className="flex gap-[20px] mb-[10px]">
            <input
              type="text"
              name="name"
              placeholder="Full Name"
              value={formData.name}
              onChange={handleChange}
              required
              className=" border-b-[1.5px] border-gray-300 p-[10px] text-txt w-full focus:outline-none"
            />
          </div>

          {/* Email */}
          <div className="flex mb-[10px]">
            <input
              type="email"
              name="email"
              placeholder="Email"
              value={formData.email}
              onChange={handleChange}
              required
              className="border-b-[1.5px] border-gray-300 text-txt p-[10px] w-full focus:outline-none"
            />
          </div>

          {/* Password*/}
          <div className="flex flex-col gap-[10px] mb-[30px]">
            <div className="flex">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                placeholder="Password"
                value={formData.password}
                onChange={handleChange}
                required
                className="border-b-[1.5px] border-gray-300 text-txt p-[10px] w-full focus:outline-none"
              />
              <button
                type="button"
                className="text-gray-500 border-b-[1.5px] border-gray-300 px-2 focus:outline-none"
                onClick={() => setShowPassword(prev => !prev)}
              >
                {showPassword ? <Eye /> : <EyeOff />}
              </button>
            </div>
          </div>

          </div>

          <div className="h-fit w-full">
          {/* Submit */}
          <button type="submit" className="w-full relative overflow-hidden bg-[#1f1f1f] min-h-[40px] text-white font-semibold text-[1.2rem] max-[640px]:text-[1rem] p-[10px] rounded-[10px]">
           Create Account
            <span className="absolute inset-0 bg-gradient-main opacity-0 hover:opacity-100 h-full flex items-center justify-center transition-opacity duration-800 rounded-[10px]">Create Account</span>
          </button>
          </div>

          <div className="h-fit w-full">
          {/* Divider */}
          <div className="flex items-center my-[10px]">
            <div className="h-[1px] bg-gray-300 w-full"></div>
            <p className="whitespace-nowrap px-[5px] text-gray-400 font-light">Or</p>
            <div className="h-[1px] bg-gray-300 w-full"></div>
          </div>

           {/* Google button.
               Google's script renders the real button into #googleBtn, which can take a
               moment. Until it does, #googleBtn is `invisible` (visibility:hidden — it
               still occupies its box, so the width measurement above stays correct) and
               the placeholder shows in its place. They are never both visible at once:
               a translucent overlay sitting on a live button reads as flickering.
               The placeholder copies GIS's own "outline / continue_with" layout: the
               G is pinned near the left edge, the label is centered across the FULL
               width (not just the space next to the icon) — that's what makes a wide
               Google button look right instead of lopsided. */}
           <div className="flex justify-center w-full">
             <div ref={googleWrapRef} className="relative h-[40px] w-full max-w-[400px]">
               <div id="googleBtn" className={"w-full flex justify-center " + (googleReady ? "" : "invisible")}></div>

               {!googleReady && (
                 <div
                   aria-hidden="true"
                   className="absolute inset-0 flex items-center justify-center gap-[10px] rounded-[4px] border border-[#dadce0] bg-white cursor-not-allowed select-none"
                 >
                   <svg width="18" height="18" viewBox="0 0 48 48" className="shrink-0">
                     <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                     <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                     <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                     <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                   </svg>
                   <span className="text-[14px] font-medium text-gray-400">Continue with Google</span>
                 </div>
               )}
             </div>
           </div>

          {/* Switch to Login */}
          <p className="text-center text-[0.9rem]  max-[640px]:text-[0.7rem] mt-[10px] text-gray-500">
            Already have an account?{' '}
            <button
              type="button"
              onClick={onSwitchToLogin}
              className="text-transparent bg-clip-text font-bold bg-gradient-main hover:underline"
            >
              Sign In
            </button>
          </p>
          </div>

        </form>
      </div>
    </div>
    
  );
};

export default Signup;