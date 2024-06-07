import {
  Box,
  Button,
  FormControl,
  Modal,
  TextField,
  Typography,
} from "@mui/material";
import axios from "axios";
import axiosRetry from "axios-retry";
import React, { useState } from "react";

interface UploadModalProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const UploadModal = () => {
  axiosRetry(axios, {
    retries: 3,
    retryDelay: (retryCount) => {
      return retryCount * 1000; // Exponential backoff
    },
  });
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setFile(event.target.files[0]);
      console.log(event.target.files[0]);
    }
  };
  const handleUpload = async () => {
    if (file) {
      const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunk size
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
      const data = new FormData();
      const fileName = Date.now().toString() + "_" + file.name;
      console.log(fileName);

      const initializeUploadResponse = await axios.post(
        "http://localhost:3001/initiateUpload",
        {
          fileName,
        }
      );
      const uploadId = initializeUploadResponse.data.uploadId;
      const uploadPromises = [];
      let uploadedChunks = 0;
      let start = 0,
        end;
      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);
        let formData = new FormData();
        console.log(formData);
        formData.append("index", i.toString());
        formData.append("totalChunks", totalChunks.toString());
        formData.append("fileName", fileName);
        formData.append("file", chunk);
        const uploadPromise = axios
          .post(`http://localhost:3001/upload/${uploadId}`, formData, {
            headers: {
              "Content-Type": "multipart/form-data",
            },
          })
          .then((response) => {
            uploadedChunks++;
            const progress = Math.floor((uploadedChunks / totalChunks) * 100);
            console.log(progress);
          });
        uploadPromises.push(uploadPromise);
      }

      await Promise.all(uploadPromises);

      // Complete multipart upload
      const completeRes = await axios.post(
        `http://localhost:3001/completeUpload/${fileName}/${uploadId}`,
        {
          title,
          description,
        }
      );
      const res = await completeRes.data;
      console.log("file link: ", res);

      // End the timer and calculate the time elapsed
      const endTime = new Date();
      const startTime = new Date(); // Ensure you have a startTime defined somewhere as a Date object

      // Convert dates to timestamps and subtract to get time elapsed in milliseconds
      const timeElapsed = (endTime.getTime() - startTime.getTime()) / 1000;

      console.log("Time elapsed:", timeElapsed, "seconds");
      alert("File uploaded successfully");
    }
  };

  const style = {
    position: "absolute" as "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: 400,
    bgcolor: "background.paper",

    p: 4,
  };
  return (
    <div>
      <Box sx={style}>
        <Typography id="modal-modal-description" sx={{ mt: 2 }}>
          <div>
            <input
              accept="video/*"
              // style={{ display: "none" }}
              id="raised-button-file"
              type="file"
              onChange={handleFileChange}
            />

            {file && (
              <div>
                <p>Selected file: {file.name}</p>
                <Box
                  component="form"
                  sx={{
                    "& .MuiTextField-root": { m: 1, width: "25ch" },
                  }}
                >
                  <FormControl>
                    <TextField
                      label="Title"
                      value={title}
                      variant="outlined"
                      onChange={(e) => {
                        setTitle(e.target.value);
                      }}
                    />
                  </FormControl>
                  <FormControl>
                    <TextField
                      label="Description"
                      value={description}
                      variant="outlined"
                      onChange={(e) => {
                        setDescription(e.target.value);
                      }}
                    />
                  </FormControl>
                </Box>
                <Button variant="contained" onClick={handleUpload}>
                  Upload
                </Button>
              </div>
            )}
          </div>
        </Typography>
      </Box>
    </div>
  );
};

export default UploadModal;
