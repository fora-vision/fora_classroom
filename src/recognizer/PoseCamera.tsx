// @ts-nocheck
import React, { FC, useEffect, useState } from "react";
import { countFPS, generateImage } from "../helpers";
import { SkeletData } from "../types";
import * as S from "../views/styled";
import stats from "../stats";

const DEBUG = false;

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
  onFps: (fsp: number) => void;
  onLoaded: () => void;
  onFrame: (data: SkeletData, width: number, height: number) => void;
  onPhoto: (frame: number, photo: Blob) => void;
  highlightSkelet: boolean;
  isSavePhotos: boolean;
  deviceId: string | null;
  style: any;
}

const flipLandmarks = (poseLandmarks: SkeletData) => {
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

export const PoseCamera: FC<Props> = (props) => {
  const { deviceId, onFrame, onPhoto, onFps, onLoaded, isSavePhotos, style, highlightSkelet } = props;
  const [pose] = useState(() => initializePose());

  useEffect(() => {
    if (deviceId == null) return;
    const videoElement = document.getElementsByClassName("input_video")[0];
    let currentStream: MediaStream;

    navigator.mediaDevices.getUserMedia({ video: { deviceId, width: 720, height: 480 } }).then((stream) => {
      currentStream = stream;
      videoElement.srcObject = stream;
      videoElement.onloadedmetadata = function () {
        console.log("LOAD");
        videoElement.play();
      };

      const { width, height } = stream.getVideoTracks()[0].getSettings();
      videoElement.height = height;
      videoElement.width = width;
    });

    return () => {
      currentStream?.getTracks().forEach((track) => track.stop());
    };
  }, [deviceId]);

  useEffect(() => {
    const videoElement = document.getElementsByClassName("input_video")[0];
    const canvasElement = document.getElementsByClassName("output_canvas")[0] as HTMLCanvasElement;
    const size = { height: 480, width: 720 };

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

    let isPreccessing = false;
    async function loop() {
      resizeCanvas();
      requestAnimationFrame(loop);

      if (videoElement.paused || videoElement.ended) return;

      if (!isPreccessing) {
        isPreccessing = true;
        pose.send({ image: videoElement }).finally(() => (isPreccessing = false));
      }
    }

    loop();
    onLoaded();
  }, []);

  useEffect(() => {
    const canvasElement = document.getElementsByClassName("output_canvas")[0];
    const canvasCtx = canvasElement.getContext("2d");

    let frames = 0;
    let lastPhotoUpdate = window.performance.now();
    let lastUpdate = window.performance.now();
    const fps = 1000 / 12; // Send max 12 fps

    const onResults = (results) => {
      stats.begin();
      onFps(countFPS());

      canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
      canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

      if (results.poseLandmarks) {
        const landmarksRight = results.poseLandmarks.map((p, i) => ({ ...p, visibility: i % 2 ? 1 : 0 }));
        const landmarks = results.poseLandmarks.map((p) => ({ ...p, visibility: 1 }));
        for (let i = 0; i < 11; i++) {
          landmarksRight[i].visibility = 0;
          landmarks[i].visibility = 0;
        }

        drawConnectors(canvasCtx, landmarks, POSE_CONNECTIONS, {
          color: highlightSkelet ? "#2bbb89" : "#5e23a2",
          lineWidth: highlightSkelet ? 24 : 16,
        });
        drawConnectors(canvasCtx, landmarksRight, POSE_CONNECTIONS, {
          color: highlightSkelet ? "#2bbb89" : "#d52152",
          lineWidth: highlightSkelet ? 24 : 16,
        });
        drawLandmarks(canvasCtx, landmarks, {
          color: highlightSkelet ? "#2bbb89" : "#5e23a2",
          lineWidth: 2,
        });
      }

      const current = window.performance.now();
      if (current - lastUpdate >= fps) {
        if (results.poseLandmarks) onFrame(flipLandmarks(results.poseLandmarks), results.image.width, results.image.height);
        lastUpdate = window.performance.now();
        frames += 1;
      }

      if (current - lastPhotoUpdate >= 1000 && isSavePhotos) {
        lastPhotoUpdate = window.performance.now();
        if (results.image instanceof HTMLCanvasElement) {
          const currentFrame = frames;
          generateImage(results.image, 640, 0.5).then((blob) => {
            if (blob == null) return;
            onPhoto(currentFrame, blob);
          });
        }
      }

      stats.end();
    };

    pose.onResults(onResults);
  }, [highlightSkelet, isSavePhotos]);

  return (
    <S.Overlay style={style}>
      <video hidden className="input_video"></video>
      <canvas style={{ margin: "auto", display: "block" }} className="output_canvas" width="1280px" height="720px"></canvas>
    </S.Overlay>
  );
};
