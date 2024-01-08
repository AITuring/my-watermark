import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import Puzzle from "./Puzzle";
import Watermark from "./Watermark";
import Lottery from "./Lottry";
import ChangeColor from "./ChangeColor";
import "./App.css";

const App = () => {
  return (
    <div className="app">
      <Router>
        <Routes>
          <Route path="/" element={<Watermark />} />
          <Route path="/puzzle" element={<Puzzle />} />
          <Route path="/lottery" element={<Lottery />} />
          <Route path="/change" element={<ChangeColor />} />
        </Routes>
      </Router>
    </div>
  );
};

export default App;
