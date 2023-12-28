import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import Puzzle from "./Puzzle";
import Watermark from "./Watermark";
import "./App.css";

const App = () => {
  return (
    <div className="app">
      <Router>
        <Routes>
          <Route path="/" element={<Watermark />} />
          <Route path="/puzzle" element={<Puzzle />} />
        </Routes>
      </Router>
    </div>
  );
};

export default App;
