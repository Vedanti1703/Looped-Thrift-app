export default function Spinner({ size = 'md', center = false }) {
  const s = size === 'sm' ? 'w-5 h-5' : size === 'lg' ? 'w-10 h-10' : 'w-7 h-7'
  return (
    <div className={center ? 'flex justify-center py-12' : 'inline-flex'}>
      <div className={`${s} border-4 border-pink-200 border-t-pink-500 rounded-full animate-spin`} />
    </div>
  )
}
