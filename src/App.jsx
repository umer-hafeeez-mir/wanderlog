import { Routes, Route } from 'react-router-dom'
import { TimelinePage } from './pages/TimelinePage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<TimelinePage />} />
      <Route path="*" element={<TimelinePage />} />
    </Routes>
  )
}
