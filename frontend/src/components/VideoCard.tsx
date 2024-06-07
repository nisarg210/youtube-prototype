import { Card, CardContent, CardMedia } from "@mui/material";
import React from "react";
import ReactPlayer from "react-player";
interface videoCardProps {
  url: string;
  title: string;
}
const VideoCard: React.FC<videoCardProps> = ({ url, title }) => {
  return (
    <div className="video-card">
      <Card sx={{ minWidth: 275 }}>
        <CardMedia>
          <ReactPlayer controls url={url} />
        </CardMedia>
        <CardContent>{title}</CardContent>
      </Card>
    </div>
  );
};

export default VideoCard;
