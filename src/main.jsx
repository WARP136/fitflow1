import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { MotionConfig } from 'framer-motion'
import Root from './Root.jsx'
import './index.css'

/* The account gate lives in Root, above the app's own store - see the note in
   src/Root.jsx for why the two are nested that way round. */
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <MotionConfig reducedMotion="always">
      <BrowserRouter>
        <Root />
      </BrowserRouter>
    </MotionConfig>
  </React.StrictMode>
)
