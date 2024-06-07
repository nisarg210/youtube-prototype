import React, { useEffect, useState } from "react";
import VideoCard from "./VideoCard";
import axios from "axios";

const VideoDashBoard = () => {
  const [videos, setVideos] = useState([]);
  useEffect(() => {
    try {
      axios.get(`http://localhost:3007/videos`).then((response) => {
        console.log(response);
        setVideos(response.data);
      });
    } catch (error) {
      console.log(error);
    }
  }, []);

  return (
    <div className="video-dashboard">
      VideoDashBoard
      {videos &&
        videos.map((video: any) => {
          return <VideoCard title={video.title} url={video.url} />;
        })}
    </div>
  );
};

export default VideoDashBoard;
