import * as React from 'react'
import { createRoot } from 'react-dom/client'

import { App } from './App'

import './style.css'

const el = document.getElementById('root')
if (el) createRoot(el).render(<App />)
