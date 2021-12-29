// @ts-nocheck
import React, { FC, useEffect, useState } from "react";
import { SkeletData } from "./models";
import * as S from './styled'

window.countFPS = (function () {
  var lastLoop = (new Date()).getMilliseconds();
  var count = 1;
  var fps = 0;

  return function () {
    var currentLoop = (new Date()).getMilliseconds();
    if (lastLoop > currentLoop) {
      fps = count;
      count = 1;
    } else {
      count += 1;
    }
    lastLoop = currentLoop;
    return fps;
  };
}());


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

export const PoseCamera: FC<Props> = ({ onFrame, highlightSkelet }) => {
  const [pose] = useState(() => initializePose());

  useEffect(() => {
    const videoElement = document.getElementsByClassName("input_video")[0];
    const canvasElement = document.getElementsByClassName("output_canvas")[0];
    const size = { width: 1280, height: 720 };

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
      },
    });

    camera.start();
  }, []);

  useEffect(() => {
    const canvasElement = document.getElementsByClassName("output_canvas")[0];
    const canvasCtx = canvasElement.getContext("2d");

    const onResults = (results) => {
      canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
      canvasCtx.drawImage(
        results.image,
        0,
        0,
        canvasElement.width,
        canvasElement.height
      );

      canvasCtx.font = "32px Montserrat";
      canvasCtx.fillText(window.countFPS() + " FPS", 50, 100)

      if (!results.poseLandmarks) return;
      onFrame(
        results.poseLandmarks.map((p) => ({
          x: p.x,
          y: p.y,
          z: p.z,
          p: p.visibility,
        }))
      );
      drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, {
        color: highlightSkelet ? "#2bbb89" : "#5e23a2",
        lineWidth: highlightSkelet ? 24 : 16,
      });
      drawLandmarks(canvasCtx, results.poseLandmarks, {
        color: highlightSkelet ? "#2bbb89" : "#5e23a2",
        lineWidth: 2,
      });
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
