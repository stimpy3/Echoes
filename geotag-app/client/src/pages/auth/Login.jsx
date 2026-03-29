import { EyeOff, Eye,X } from 'lucide-react';
import { useState,useEffect,useRef,useMemo,useCallback } from 'react';
import { Link } from "react-router-dom";
import Lottie from "lottie-react";
import animationData from "../../data/animationData/startingAnimation.json";
import SplitText from "../../components/Layout/SplitText";
import LightRays from '../../components/Layout/LightRays';
import axios from "axios";
import BareHomePage from '../BarebonesPages/BareHomePage';
import { useNavigate } from 'react-router-dom';
import { gsap } from 'gsap';


const Login = ({ onSwitchToSignup }) => {

  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

   const BASE_URL=import.meta.env.VITE_BASE_URL || "http://localhost:5000";

  const handleSubmit =async (e) => {
    e.preventDefault();
    
    try {
  if (!formData.email || !formData.password) {
    setError('All fields are required');
    setLoading(false);
    return;
  }

  setLoading(true);
  setError('');

  const response = await axios.post(`${BASE_URL}/api/auth/login`, {
    email: formData.email,
    password: formData.password
  }, { withCredentials: true });

  setFormData({ name: '', email: '', password: '', confirmPassword: '' });
  navigate('/home');
} catch (err) {
  console.error("Login error:", err);
  setError(err.response?.data?.message || 'Login failed. Please try again.');
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
          stagger: 0.3,
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



//google part
/*The problem is that window.google might not be ready yet when your useEffect first runs
especially after a refresh or fast route switch.
That’s why the Google button sometimes disappears. */
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
  setLoading(true); // start loading

  try {
    const res = await axios.post(
      `${BASE_URL}/api/auth/google`,
      { token: response.credential },
      { withCredentials: true } // very important! for cookies
    );

    // console.log("Google login success:", res.data);

    if (res.data.isNewUser) {
      navigate("/homelocation"); // redirect new users
    } else {
      navigate("/home"); // redirect existing users
    }
  } catch (err) {
    console.error("Google login failed:", err.response?.data || err);
  } finally {
    setLoading(false); // stop loading no matter success or fail
  }
};

  return (
    loading?
    //bare bones of home page nav bar as placeholder while loading
   <BareHomePage/>
      :
    <div className="min-h-[100vh] w-[100vw] relative max-[550px]:max-h-fit flex max-[550px]:flex-col items-center bg-dlightMain">
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
                className="scale-[1.2] max-[550px]:bottom-[15%] absolute bottom-[40px] left-1/2 -translate-x-1/2 h-[85px] w-[70px]"
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
                className="scale-[0.9] absolute bottom-[100px] max-[550px]:bottom-[25%] max-[740px]:bottom-[150px] left-[15%] max-[740px]:left-[10%] h-[85px] w-[70px]"
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
                className="scale-[0.7] absolute bottom-[150px]  max-[550px]:bottom-[30%]  max-[740px]:bottom-[200px] right-[15%] max-[740px]:right-[10%] h-[85px] w-[70px]"
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
      {/* Right side login panel */}
      <div className="formDiv text-txt flex justify-center items-center absolute z-10 h-full min-h-[50%] max-[550px]:h-fit w-[50%] max-[550px]:w-[100%] bottom-0  right-0 bg-main shadow-lg rounded-l-[30px]  max-[550px]:rounded-bl-none max-[550px]:rounded-t-[30px]">
        <form
          onSubmit={handleSubmit}
          className="p-[30px] px-[50px] min-h-[50vh] max-h-[600px] justify-around max-[550px]:py-[10px] w-full flex flex-col"
        >
          <div className="h-fit w-full">
              <p className="text-[2rem] max-[640px]:text-[1.8rem] h-fit max-[550px]:my-[10px] max-[550px]:text-center text-txt font-semibold mb-[20px]">Login In</p>
          </div>

         <div className="h-fit w-full">
          {/* Email field */}
          <div className="flex mb-[20px] max-[550px]:mb-[10px]">
            <input
              type="email"
              name="email"
              placeholder="Email"
              value={formData.email}
              onChange={handleChange}
              required
              className=" border-b-[1.5px] border-gray-300 p-[10px] max-[550px]:p-[5px] w-full focus:outline-none"
            />
          </div>

          {/* Password field with toggle */}
          <div className="flex mb-[30px] max-[550px]:mb-[20px]">
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              placeholder="Password"
              value={formData.password}
              onChange={handleChange}
              required
              className="border-b-[1.5px] border-gray-300 p-[10px] max-[550px]:p-[5px] w-full focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="text-gray-500 border-b-[1.5px] border-gray-300 px-2"
            >
              {showPassword ? <Eye /> : <EyeOff />}
            </button>
          </div>
          

          {/* Submit */}
          <button type="submit" className="w-full relative overflow-hidden bg-[#1f1f1f] text-white font-semibold min-h-[40px] text-[1.2rem] max-[640px]:text-[1rem] max-[550px]:p-[5px] p-[10px] rounded-[10px]">
           Log In
            <span className="absolute inset-0 bg-gradient-main opacity-0 hover:opacity-100 h-full flex items-center justify-center transition-opacity duration-800 rounded-[10px]">Log In</span>
          </button>
          </div>


          <div className="h-fit w-full">
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
      
          {/* Switch to Signup */}
          <p className="text-center text-[0.9rem] max-[640px]:text-[0.7rem] mt-[10px] text-gray-500">
            Don't have an Account?{" "}
            <button
              type="button"
              onClick={onSwitchToSignup}
              className="text-transparent bg-clip-text font-bold bg-gradient-main hover:underline"
            >
              Create account
            </button>
          </p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;
