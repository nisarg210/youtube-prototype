import React, { useState } from "react";
// import logo from "./logo.svg";
import "./App.css";
import Nav from "./components/Nav";
import { Divider } from "@mui/material";
import UploadModal from "./components/UploadModal";
import VideoDashBoard from "./components/VideoDashBoard";
import { Route, BrowserRouter as Router, Routes } from "react-router-dom";

function App() {
  const [open, setOpen] = useState(false);
  return (
    <Router>
      <div className="App">
        <Nav open={open} setOpen={setOpen} />
        <Divider />
        <Routes>
          <Route path="/" element={<VideoDashBoard />} />
          <Route path="/upload" element={<UploadModal />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
