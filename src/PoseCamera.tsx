// @ts-nocheck
import React, { FC, useEffect, useState } from "react";
import { SkeletData } from "./models";

const initializePose = () => {
  const pose = new Pose({
    locateFile: (file) => {
      return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
    },
  });

  pose.setOptions({
    selfieMode: true,
    modelComplexity: 1,
    smoothLandmarks: true,
    enableSegmentation: false,
    smoothSegmentation: false,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });

  return pose;
};

interface Props {
  onFrame: (data: SkeletData) => void;
}

export const PoseCamera: FC<Props> = ({ onFrame }) => {
  const [pose] = useState(() => initializePose());

  useEffect(() => {
    const videoElement = document.getElementsByClassName("input_video")[0];
    const canvasElement = document.getElementsByClassName("output_canvas")[0];
    const size = { width: 1280, height: 720 }

    const camera = new Camera(videoElement, {
      ...size,
      onFrame: async () => {
        const aspect = size.height / size.width;
        let width: number, height: number;

        if (window.innerWidth > window.innerHeight) {
          height = window.innerHeight;
          width = height / aspect;
        } else {
          width = window.innerWidth;
          height = width * aspect;
        }

        canvasElement.width = width;
        canvasElement.height = height;

        await pose.send({ image: videoElement });
      }
    });

    camera.start();
  }, []);

  useEffect(() => {
    const canvasElement = document.getElementsByClassName("output_canvas")[0];
    const canvasCtx = canvasElement.getContext("2d");

    const onResults = (results) => {
      if (!results.poseLandmarks) return;
      onFrame(results.poseLandmarks.map((p) => ({ x: p.x, y: p.y, z: p.z, p: p.visibility })));

      canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
      canvasCtx.drawImage(
        results.image,
        0,
        0,
        canvasElement.width,
        canvasElement.height
      );

      drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, {
        color: "#00FF00",
        lineWidth: 4,
      });
      drawLandmarks(canvasCtx, results.poseLandmarks, {
        color: "#FF0000",
        lineWidth: 2,
      });
    };

    pose.onResults(onResults);
  }, []);

  return (
    <>
      <video hidden className="input_video"></video>
      <canvas style={{ margin: 'auto', display: 'block' }} className="output_canvas" width="1280px" height="720px"></canvas>
    </>
  );
};
