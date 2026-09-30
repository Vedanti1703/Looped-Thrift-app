import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function SplashPage() {
  const navigate = useNavigate();

  const handleEnter = () => {
    sessionStorage.setItem('splashSeen', 'true');
    navigate('/', { replace: true });
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      sessionStorage.setItem('splashSeen', 'true');
      navigate('/', { replace: true });
    }, 5000);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="splash-stage">
      <style>{`
        :root {
          --pink-blush: #FBDCE8;
          --pink-rose: #F5A9C9;
          --pink-hot: #EC6FA7;
          --pink-deep: #C94E82;
          --pink-mauve: #8F3F63;
          --cream: #FBF4EC;
          --gold: #D8B589;
        }

        .splash-stage {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          height: 100dvh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: radial-gradient(circle at 50% 30%, #fff 0%, #FBDCE8 55%, #F5A9C9 100%);
          z-index: 9999;
          overflow: hidden;
          box-sizing: border-box;
          font-family: 'Fredoka', sans-serif;
        }

        .splash-frame {
          position: relative;
          width: 100%;
          height: 100%;
          max-width: 520px;
          max-height: 960px;
          margin: 0 auto;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        @media (min-width: 640px) {
          .splash-frame {
            max-height: min(960px, 92vh);
            height: 92vh;
            border-radius: 28px;
            box-shadow: 0 30px 80px -20px rgba(140, 40, 80, 0.45);
          }
        }

        /* ---------- CURTAINS ---------- */
        .splash-curtain-wrap {
          position: absolute;
          top: 0;
          height: 100%;
          width: 52%;
          z-index: 20;
          overflow: visible;
        }

        .splash-curtain-wrap img {
          height: 104%;
          display: block;
          filter: drop-shadow(0 10px 30px rgba(140, 40, 80, 0.35));
        }

        .splash-curtain-wrap.left {
          left: 0;
          animation: openLeft 1.2s 0.4s cubic-bezier(0.66, 0, 0.3, 1) both;
        }

        .splash-curtain-wrap.left img {
          float: right;
          animation: swayL 5s 1.7s ease-in-out infinite;
          transform-origin: top right;
        }

        .splash-curtain-wrap.right {
          right: 0;
          animation: openRight 1.2s 0.4s cubic-bezier(0.66, 0, 0.3, 1) both;
        }

        .splash-curtain-wrap.right img {
          float: left;
          animation: swayR 5s 1.9s ease-in-out infinite;
          transform-origin: top left;
        }

        @keyframes openLeft {
          0% { transform: translateX(46%); }
          100% { transform: translateX(0%); }
        }

        @keyframes openRight {
          0% { transform: translateX(-46%); }
          100% { transform: translateX(0%); }
        }

        @keyframes swayL {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(0.6deg); }
        }

        @keyframes swayR {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(-0.6deg); }
        }

        /* ---------- WORDMARK ---------- */
        #splash-wordmark {
          position: relative;
          z-index: 10;
          text-align: center;
          opacity: 0;
          transform: scale(0.7) translateY(10px);
          animation: markIn 0.7s 1.3s cubic-bezier(0.2, 0.9, 0.3, 1.3) forwards;
        }

        @keyframes markIn {
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        #splash-wordmark .eyebrow {
          font-size: 12px;
          letter-spacing: 0.4em;
          text-transform: uppercase;
          color: #8F3F63;
          opacity: 0.75;
          margin-bottom: 6px;
          font-family: 'Fredoka', sans-serif;
        }

        #splash-wordmark h1 {
          margin: 0;
          font-family: 'Parisienne', cursive;
          font-weight: 400;
          font-size: clamp(52px, 13vw, 96px);
          line-height: 1;
          background: linear-gradient(100deg, var(--pink-deep) 20%, var(--pink-hot) 45%, var(--gold) 52%, var(--pink-hot) 60%, var(--pink-deep) 80%);
          background-size: 250% 100%;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: shimmer 2.6s 2.05s ease-in-out infinite;
        }

        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -50% 0; }
        }

        #splash-wordmark .tagline {
          margin-top: 6px;
          font-family: 'Fredoka', sans-serif;
          font-weight: 500;
          font-size: 13.5px;
          color: #8F3F63;
          letter-spacing: 0.06em;
        }

        #splash-loop-ribbon {
          width: 70px;
          height: 34px;
          margin: 10px auto 0;
          opacity: 0;
          animation: markIn 0.6s 2.3s ease forwards;
        }

        #splash-loop-ribbon svg {
          width: 100%;
          height: 100%;
        }

        #splash-loop-ribbon path {
          fill: none;
          stroke: #EC6FA7;
          stroke-width: 4;
          stroke-linecap: round;
          stroke-dasharray: 140;
          stroke-dashoffset: 140;
          animation: drawLoop 1.8s 2.5s ease-in-out infinite;
        }

        @keyframes drawLoop {
          0% { stroke-dashoffset: 140; }
          45% { stroke-dashoffset: 0; }
          80% { stroke-dashoffset: 0; opacity: 1; }
          100% { stroke-dashoffset: -140; opacity: 1; }
        }

        /* ---------- CUTOUTS ---------- */
        .splash-cutout {
          position: absolute;
          z-index: 15;
          opacity: 0;
          filter: drop-shadow(0 10px 16px rgba(140, 40, 80, 0.3));
          animation-fill-mode: forwards;
        }

        .splash-cutout img {
          width: 100%;
          height: auto;
          display: block;
        }

        .c-top { width: 104px; top: 14%; left: 12%; }
        .c-dress { width: 96px; top: 15%; right: 11%; }
        .c-shirt { width: 112px; top: 64%; left: 9%; }
        .c-hoodie { width: 112px; top: 62%; right: 9%; }
        .c-star-a { width: 26px; top: 8%; left: 44%; }
        .c-star-b { width: 20px; top: 82%; right: 36%; }
        .c-star-c { width: 18px; top: 30%; left: 6%; }

        .c-top { animation: dropIn 0.55s 1.55s cubic-bezier(0.2, 0.9, 0.3, 1.4) forwards, wiggle 2.6s 2.15s ease-in-out infinite; }
        .c-dress { animation: dropIn 0.55s 1.7s cubic-bezier(0.2, 0.9, 0.3, 1.4) forwards, wiggle 2.4s 2.3s ease-in-out infinite; }
        .c-shirt { animation: dropIn 0.55s 1.85s cubic-bezier(0.2, 0.9, 0.3, 1.4) forwards, wiggle 2.8s 2.45s ease-in-out infinite; }
        .c-hoodie { animation: dropIn 0.55s 2.0s cubic-bezier(0.2, 0.9, 0.3, 1.4) forwards, wiggle 2.5s 2.6s ease-in-out infinite; }
        .c-star-a { animation: dropIn 0.5s 1.4s cubic-bezier(0.2, 0.9, 0.3, 1.4) forwards, twinkle 1.6s 1.95s ease-in-out infinite; }
        .c-star-b { animation: dropIn 0.5s 1.95s cubic-bezier(0.2, 0.9, 0.3, 1.4) forwards, twinkle 1.4s 2.5s ease-in-out infinite; }
        .c-star-c { animation: dropIn 0.5s 1.5s cubic-bezier(0.2, 0.9, 0.3, 1.4) forwards, twinkle 1.7s 2.05s ease-in-out infinite; }

        @keyframes dropIn {
          0% { opacity: 0; transform: translateY(-40px) rotate(-8deg) scale(0.7); }
          70% { opacity: 1; }
          100% { opacity: 1; transform: translateY(0) rotate(0deg) scale(1); }
        }

        @keyframes wiggle {
          0%, 100% { transform: rotate(-4deg); }
          50% { transform: rotate(4deg); }
        }

        @keyframes twinkle {
          0%, 100% { transform: scale(1) rotate(0deg); opacity: 1; }
          50% { transform: scale(1.3) rotate(18deg); opacity: 0.7; }
        }

        /* ---------- TAP TO ENTER ---------- */
        #splash-enter {
          position: absolute;
          bottom: 6%;
          left: 50%;
          transform: translateX(-50%);
          z-index: 30;
          opacity: 0;
          font-family: 'Fredoka', sans-serif;
          font-weight: 600;
          font-size: 13px;
          letter-spacing: 0.08em;
          color: #fff;
          background: #EC6FA7;
          padding: 12px 30px;
          border-radius: 999px;
          border: none;
          cursor: pointer;
          box-shadow: 0 10px 24px -8px rgba(201, 78, 130, 0.7);
          animation: enterIn 0.5s 3.6s ease forwards;
        }

        @keyframes enterIn {
          to { opacity: 1; }
        }

        #splash-enter:active {
          transform: translateX(-50%) scale(0.96);
        }

        @media (max-width: 380px) {
          .c-top { width: 82px; }
          .c-dress { width: 76px; }
          .c-shirt { width: 88px; }
          .c-hoodie { width: 88px; }
          .c-star-a { width: 20px; }
          .c-star-b { width: 16px; }
          .c-star-c { width: 14px; }
          #splash-wordmark h1 { font-size: clamp(40px, 15vw, 64px); }
          #splash-wordmark .tagline { font-size: 12px; }
          #splash-enter { padding: 10px 24px; font-size: 12px; }
        }

        @media (max-height: 700px) {
          .c-top, .c-dress { top: 11%; }
          .c-shirt, .c-hoodie { top: 60%; }
          #splash-enter { bottom: 4%; }
        }
      `}</style>

      <div className="splash-frame">
        <div className="splash-curtain-wrap left">
          <img src="/splash/curtain-left.png" alt="" />
        </div>
        <div className="splash-curtain-wrap right">
          <img src="/splash/curtain-right.png" alt="" />
        </div>

        <div className="splash-cutout c-top"><img src="/splash/top.png" alt="Top" /></div>
        <div className="splash-cutout c-dress"><img src="/splash/dress.png" alt="Dress" /></div>
        <div className="splash-cutout c-shirt"><img src="/splash/shirt.png" alt="Shirt" /></div>
        <div className="splash-cutout c-hoodie"><img src="/splash/hoodie.png" alt="Hoodie" /></div>

        <div className="splash-cutout c-star-a">
          <svg viewBox="0 0 100 100">
            <path d="M50 6 L61 39 L96 39 L67 60 L78 94 L50 73 L22 94 L33 60 L4 39 L39 39 Z" fill="#EC6FA7" stroke="#8F3F63" strokeWidth="4" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="splash-cutout c-star-b">
          <svg viewBox="0 0 100 100">
            <path d="M50 6 L61 39 L96 39 L67 60 L78 94 L50 73 L22 94 L33 60 L4 39 L39 39 Z" fill="#D8B589" stroke="#8F3F63" strokeWidth="4" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="splash-cutout c-star-c">
          <svg viewBox="0 0 100 100">
            <path d="M50 6 L61 39 L96 39 L67 60 L78 94 L50 73 L22 94 L33 60 L4 39 L39 39 Z" fill="#F5A9C9" stroke="#8F3F63" strokeWidth="4" strokeLinejoin="round" />
          </svg>
        </div>

        <div id="splash-wordmark">
          <div className="eyebrow">Welcome to</div>
          <h1>Looped</h1>
          <div className="tagline">your closet, always in rotation ✦</div>
          <div id="splash-loop-ribbon">
            <svg viewBox="0 0 70 34">
              <path d="M8 20 C8 8, 26 8, 26 20 C26 32, 8 32, 8 20 C8 8, 44 4, 62 16 C 66 19, 60 24, 55 20" />
            </svg>
          </div>
        </div>

        <button id="splash-enter" onClick={handleEnter}>
          Tap to enter ✦
        </button>
      </div>
    </div>
  );
}
