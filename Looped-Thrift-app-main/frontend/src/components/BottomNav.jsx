// import { useNavigate, useLocation } from 'react-router-dom'
// import { useCart } from '../context/CartContext'

// const NAV = [
//   { path: '/swipe',    icon: SwipeIcon,   label: 'Swipe'    },
//   { path: '/discover', icon: DiscoverIcon, label: 'Discover' },
//   { path: '/',         icon: HomeIcon,     label: 'Home',   center: true },
//   { path: '/cart',     icon: CartIcon,     label: 'Cart'    },
//   { path: '/chat',     icon: ChatIcon,     label: 'Chat'    },
// ]

// export default function BottomNav() {
//   const navigate  = useNavigate()
//   const { pathname } = useLocation()
//   const { cartItems } = useCart()

//   return (
//     <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-pink-100 bottom-nav z-50">
//       <div className="flex justify-around items-center h-16 max-w-lg mx-auto px-2">
//         {NAV.map(({ path, icon: Icon, label, center }) => {
//           const active = pathname === path
//           return (
//             <button
//               key={path}
//               onClick={() => navigate(path)}
//               className={`flex flex-col items-center gap-0.5 flex-1 py-1 relative
//                 ${center
//                   ? 'bg-pink-500 rounded-2xl mx-1 py-3 -mt-5 shadow-lg shadow-pink-200'
//                   : ''}`}
//             >
//               <Icon
//                 size={center ? 22 : 20}
//                 color={center ? 'white' : active ? '#ec4899' : '#9ca3af'}
//               />
//               {!center && (
//                 <span className={`text-[10px] font-medium ${active ? 'text-pink-500' : 'text-gray-400'}`}>
//                   {label}
//                 </span>
//               )}
//               {/* Cart badge */}
//               {path === '/cart' && cartItems.length > 0 && (
//                 <span className="absolute top-0 right-2 bg-pink-500 text-white text-[9px] font-bold
//                                  w-4 h-4 rounded-full flex items-center justify-center">
//                   {cartItems.length}
//                 </span>
//               )}
//             </button>
//           )
//         })}
//       </div>
//     </nav>
//   )
// }

// /* ── Inline SVG Icons ── */
// function HomeIcon({ size, color }) {
//   return (
//     <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
//       <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z"/>
//       <path d="M9 21V12h6v9"/>
//     </svg>
//   )
// }
// function SwipeIcon({ size, color }) {
//   return (
//     <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
//       <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
//     </svg>
//   )
// }
// function DiscoverIcon({ size, color }) {
//   return (
//     <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
//       <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
//     </svg>
//   )
// }
// function CartIcon({ size, color }) {
//   return (
//     <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
//       <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>
//     </svg>
//   )
// }
// function ChatIcon({ size, color }) {
//   return (
//     <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
//       <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
//     </svg>
//   )
// }


import { useNavigate, useLocation } from 'react-router-dom'

// 5 nav items — Rent and Auction navigate to their coming-soon pages
const NAV = [
  { path: '/swipe',    icon: SwipeIcon,    label: 'Swipe'    },
  { path: '/discover', icon: DiscoverIcon, label: 'Discover' },
  { path: '/',         icon: HomeIcon,     label: 'Home',    center: true },
  { path: '/rent',     icon: RentIcon,     label: 'Rent'     },
  { path: '/auction',  icon: AuctionIcon,  label: 'Auction'  },
]

export default function BottomNav() {
  const navigate     = useNavigate()
  const { pathname } = useLocation()

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-pink-100 z-50"
         style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto px-1">
        {NAV.map(({ path, icon: Icon, label, center }) => {
          const active = pathname === path
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-1 transition-all
                ${center
                  ? 'bg-pink-500 rounded-2xl mx-1 py-3 -mt-5 shadow-lg shadow-pink-200'
                  : ''}`}
            >
              <Icon
                size={center ? 22 : 20}
                color={center ? 'white' : active ? '#ec4899' : '#9ca3af'}
              />
              {!center && (
                <span className={`text-[10px] font-medium leading-none
                  ${active ? 'text-pink-500' : 'text-gray-400'}`}>
                  {label}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}

/* ── Icons ── */
function HomeIcon({ size, color }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z"/>
      <path d="M9 21V12h6v9"/>
    </svg>
  )
}
function SwipeIcon({ size, color }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  )
}
function DiscoverIcon({ size, color }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/>
      <path d="m21 21-4.35-4.35"/>
    </svg>
  )
}
function RentIcon({ size, color }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.57a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.57a2 2 0 0 0-1.34-2.23z"/>
    </svg>
  )
}
function AuctionIcon({ size, color }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m14.5 12.5-8 8a2.12 2.12 0 0 1-3-3l8-8"/>
      <path d="m16 16 6-6"/>
      <path d="m8 8 6-6"/>
      <path d="m9 7 8 8"/>
      <path d="m21 11-8-8"/>
    </svg>
  )
}
