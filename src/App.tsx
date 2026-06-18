import { AppProvider, useApp } from './context/AppContext'
import { NavBar } from './components/NavBar'
import { Repository } from './components/repository/Repository'
import { Shopping } from './components/shopping/Shopping'
import { Cook } from './components/cook/Cook'
import { Journal } from './components/journal/Journal'
import { Toaster } from './components/ui/Toaster'

function Sections() {
  const { section } = useApp()
  return (
    <main key={section} className="animate-fade-in pb-16">
      {section === 'repository' && <Repository />}
      {section === 'shopping' && <Shopping />}
      {section === 'cook' && <Cook />}
      {section === 'journal' && <Journal />}
    </main>
  )
}

function Shell() {
  const { section } = useApp()
  // The Repository wears the royal-blue theme; the other tabs stay on cream for now.
  return (
    <div className={`min-h-full ${section === 'repository' ? 'bg-royal' : 'bg-cream'}`}>
      <NavBar />
      <Sections />
      <Toaster />
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  )
}
