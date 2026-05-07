import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import PublicationDetail from './pages/PublicationDetail';
import HashtagAnalysis from './pages/HashtagAnalysis';
import './styles/App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/publication/:id" element={<PublicationDetail />} />
          <Route path="/analyze/:hashtag" element={<HashtagAnalysis />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;