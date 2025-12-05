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

const Signup = ({ onSwitchToLogin }) => {

  const navigate = useNavigate();

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({ 
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
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
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match!');
      return;
    }

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

      setSuccess('Account created successfully!');
      setFormData({ name: '', email: '', password: '', confirmPassword: '' });//reset
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
    // Select all pins using ref array
    gsap.fromTo(
  pinsRef.current,
  { opacity: 0, y: 50, scale: 0 },
  {
    delay: 0.5,
    opacity: 1,
    y: 0,
    scale: (i) => parseFloat(pinsRef.current[i].getAttribute('data-scale')),
    duration: 0.8,
    stagger: 0.2,
    ease: 'power3.out',
  }
);
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
  const initializeGoogleButton = () => {
    if (window.google && document.getElementById("googleBtn")) {
      google.accounts.id.initialize({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse,
      });

      google.accounts.id.renderButton(
        document.getElementById("googleBtn"),
        {
          theme: "outline",
          size: "large",
          text: "continue_with",
          shape: "rectangular",
          width: "100%",
        }
      );
    } else {
      // Retry after a short delay if google object isn’t loaded yet
      setTimeout(initializeGoogleButton, 300);
    }
  };

  initializeGoogleButton();
}, []);


 const handleCredentialResponse = async (response) => {
  setLoading(true); // start loading before API call

  try {
    const res = await axios.post(
      `${BASE_URL}/api/auth/google`,
      { token: response.credential },
      { withCredentials: true } // needed for cookies
    );

    console.log("Google login success:", res.data);

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
    <div className="h-[100vh] w-[100vw] relative flex items-center bg-dlightMain">
      {(error)?
      <div className='flex items-center text-white bg-red-500/30 backdrop-blur-md absolute z-[50] top-[20px] left-[50%] -translate-x-1/2 p-[10px] rounded-md border-[1px] border-red-500'>
        {error}
        <button className='pl-[5px] text-red-600' onClick={()=>setError(prev => !prev)}><X></X></button>
      </div>:
      <div className='display-none'></div>
      }
      
      <div className="visualDiv relative flex justify-start items-center w-[50%] h-full transparent overflow-hidden">
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
          <div datalabel="logo" className="absolute top-[20px] left-[20px] w-[40px] h-[40px] bg-[url('/logo.png')] bg-contain bg-center bg-no-repeat"></div>
          <SplitText
           text="Moments Made Timeless"
           className="absolute z-[10] top-[20%] left-1/2 -translate-x-1/2 text-6xl font-bold mb-2 text-dtxt"
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
                className="scale-[1.2] absolute bottom-[40px] left-1/2 -translate-x-1/2 h-[85px] w-[70px]"
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
                className="scale-[0.9] absolute bottom-[100px] left-[15%] h-[85px] w-[70px]"
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
                className="scale-[0.7] absolute bottom-[150px] right-[15%] h-[85px] w-[70px]"
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
      <div className="formDiv flex justify-center absolute z-10 h-full w-[50%] top-0 right-0 bg-main shadow-lg rounded-l-[30px]">
        <form
          onSubmit={handleSubmit}
          className="p-[30px] px-[50px] w-full h-full flex flex-col justify-center"
        >
          <p className="text-[2rem] text-txt font-semibold mb-[20px]">Create Account</p>

          {/* Name */}
          <div className="flex gap-[20px] mb-[10px]">
            <input
              type="text"
              name="name"
              placeholder="Full Name"
              value={formData.name}
              onChange={handleChange}
              required
              className=" border-b-[2px] border-gray-300 p-[10px] text-txt w-full focus:outline-none"
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
              className="border-b-[2px] border-gray-300 text-txt p-[10px] w-full focus:outline-none"
            />
          </div>

          {/* Password + Confirm Password */}
          <div className="flex flex-col gap-[10px] mb-[30px]">
            <div className="flex">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                placeholder="Password"
                value={formData.password}
                onChange={handleChange}
                required
                className="border-b-[2px] border-gray-300 text-txt p-[10px] w-full focus:outline-none"
              />
              <button
                type="button"
                className="text-gray-500 border-b-[2px] border-gray-300 px-2 focus:outline-none"
                onClick={() => setShowPassword(prev => !prev)}
              >
                {showPassword ? <Eye /> : <EyeOff />}
              </button>
            </div>

          <div className="flex">
            <input
              type={showPassword ? "text" : "password"}
              name="confirmPassword"
              placeholder="Confirm Password"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              className="border-b-[2px] border-gray-300 text-txt p-[10px] w-full focus:outline-none"
            />
            <button
                type="button"
                className="text-gray-500 border-b-[2px] border-gray-300 px-2 focus:outline-none"
                onClick={() => setShowPassword(prev => !prev)}
              >
                {showPassword ? <Eye /> : <EyeOff />}
              </button>
              </div>
          </div>

          {/* Submit */}
          <button type="submit" className="relative overflow-hidden bg-[#1f1f1f] text-white font-semibold text-[1.2rem] p-[10px] rounded-[10px]">
           Create Account
            <span className="absolute inset-0 bg-gradient-main opacity-0 hover:opacity-100 h-full flex items-center justify-center transition-opacity duration-800 rounded-[10px]">Create Account</span>
          </button>

          {/* Divider */}
          <div className="flex items-center my-[10px]">
            <div className="h-[1.5px] bg-gray-300 w-full"></div>
            <p className="whitespace-nowrap px-[5px] text-gray-400">Or</p>
            <div className="h-[1.5px] bg-gray-300 w-full"></div>
          </div>

           {/* Google button */}
           <div className="flex justify-center w-full">
             <div id="googleBtn" className="w-full flex justify-center"></div>
           </div>

          {/* Switch to Login */}
          <p className="text-center text-[0.9rem] mt-[10px] text-gray-500">
            Already have an account?{' '}
            <button
              type="button"
              onClick={onSwitchToLogin}
              className="text-transparent bg-clip-text font-bold bg-gradient-main hover:underline"
            >
              Sign In
            </button>
          </p>
        </form>
      </div>
    </div>
    
  );
};

export default Signup;