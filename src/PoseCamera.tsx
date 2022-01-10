// @ts-nocheck
import React, { FC, useEffect, useState } from "react";
import { SkeletData } from "./models";
import * as S from "./styled";

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
  highlightSkelet: boolean;
}

const flipLandmarks = (poseLandmarks) => {
  const points = poseLandmarks.map((p) => ({
    x: 1 - p.x,
    y: p.y,
    z: p.z,
    p: p.visibility,
  }));

  for (let i = 1; i < points.length; i += 2) {
    let a = points[i];
    let b = points[i + 1];
    points[i] = b;
    points[i + 1] = a;
  }

  return points;
};

export const PoseCamera: FC<Props> = ({ onFrame, onInfo, highlightSkelet }) => {
  const [pose] = useState(() => initializePose());

  useEffect(() => {
    const videoElement = document.getElementsByClassName("input_video")[0];
    const canvasElement = document.getElementsByClassName("output_canvas")[0];
    const size = { width: 1280, height: 720 };

    const resizeCanvas = () => {
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
    };

    const camera = new Camera(videoElement, {
      ...size,
      onFrame: async () => {
        resizeCanvas();
        await pose.send({ image: videoElement });
      },
    });
    camera.start();
  }, []);

  useEffect(() => {
    const canvasElement = document.getElementsByClassName("output_canvas")[0];
    const canvasCtx = canvasElement.getContext("2d");

    let lastUpdate = window.performance.now();
    const fps = 1000 / 13; // Send max 12 fps

    const onResults = (results) => {
      const current = window.performance.now();
      if (current - lastUpdate >= fps) {
        lastUpdate = window.performance.now();
        if (results.poseLandmarks) {
          onFrame(flipLandmarks(results.poseLandmarks));
        }
      }

      canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
      canvasCtx.drawImage(
        results.image,
        0,
        0,
        canvasElement.width,
        canvasElement.height
      );

      if (results.poseLandmarks) {
        drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, {
          color: highlightSkelet ? "#2bbb89" : "#5e23a2",
          lineWidth: highlightSkelet ? 24 : 16,
        });
        drawLandmarks(canvasCtx, results.poseLandmarks, {
          color: highlightSkelet ? "#2bbb89" : "#5e23a2",
          lineWidth: 2,
        });
      }
    };

    pose.onResults(onResults);
  }, [highlightSkelet]);

  return (
    <S.Overlay>
      <video hidden className="input_video"></video>
      <canvas
        style={{ margin: "auto", display: "block" }}
        className="output_canvas"
        width="1280px"
        height="720px"
      ></canvas>
    </S.Overlay>
  );
};
