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

export default function App() {
  return (
    <AppProvider>
      <div className="min-h-full bg-royal">
        <NavBar />
        <Sections />
        <Toaster />
      </div>
    </AppProvider>
  )
}
