import React from 'react'

export default function CheckoutStepper({ currentStep, onStepClick }) {
  const steps = [
    { number: 1, id: 'address', label: 'Delivery' },
    { number: 2, id: 'review', label: 'Review' },
    { number: 3, id: 'payment', label: 'Payment' }
  ]

  return (
    <div className="bg-white border-b border-pink-100 px-4 py-3">
      <div className="flex items-center justify-between max-w-sm mx-auto relative">
        {/* Background Connecting Line */}
        <div className="absolute top-3.5 left-6 right-6 h-0.5 bg-gray-200 -z-0" />
        
        {/* Active Connecting Line */}
        <div
          className="absolute top-3.5 left-6 h-0.5 bg-pink-500 -z-0 transition-all duration-300"
          style={{
            width: currentStep === 1 ? '0%' : currentStep === 2 ? '50%' : '88%'
          }}
        />

        {steps.map((step) => {
          const isCompleted = step.number < currentStep
          const isCurrent = step.number === currentStep

          return (
            <button
              key={step.id}
              type="button"
              onClick={() => isCompleted && onStepClick(step.number)}
              disabled={!isCompleted}
              className={`flex flex-col items-center z-10 transition-all ${
                isCompleted ? 'cursor-pointer' : 'cursor-default'
              }`}
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-200 ${
                  isCompleted
                    ? 'bg-emerald-500 text-white shadow-xs'
                    : isCurrent
                    ? 'bg-pink-500 text-white ring-4 ring-pink-100 shadow-xs'
                    : 'bg-gray-100 text-gray-400 border border-gray-200'
                }`}
              >
                {isCompleted ? '✓' : step.number}
              </div>
              <span
                className={`text-[11px] font-semibold mt-1 transition-colors ${
                  isCurrent
                    ? 'text-pink-600'
                    : isCompleted
                    ? 'text-gray-700'
                    : 'text-gray-400'
                }`}
              >
                {step.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
