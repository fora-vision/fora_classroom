// @ts-ignore
import workletUrl from "worklet:./recognizer-processor.js";

async function initVoiceAssitant() {
  const channel = new MessageChannel();

  // @ts-ignore
  const model = await Vosk.createModel("https://ccoreilly.github.io/vosk-browser/models/vosk-model-small-ru-0.4.tar.gz");
  model.registerPort(channel.port1);

  const sampleRate = 48000;
  const recognizer = new model.KaldiRecognizer(sampleRate);
  recognizer.setWords(true);

  const mediaStream = await navigator.mediaDevices.getUserMedia({
    video: false,
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      channelCount: 1,
      sampleRate,
    },
  });

  const audioContext = new AudioContext();
  await audioContext.audioWorklet.addModule(workletUrl);

  const recognizerProcessor = new AudioWorkletNode(audioContext, "recognizer-processor", {
    numberOfOutputs: 1,
    numberOfInputs: 1,
    channelCount: 1,
  });

  recognizerProcessor.port.postMessage({ action: "init", recognizerId: recognizer.id }, [channel.port2]);
  recognizerProcessor.connect(audioContext.destination);

  const source = audioContext.createMediaStreamSource(mediaStream);
  source.connect(recognizerProcessor);

  return recognizer;
}

export default initVoiceAssitant;
