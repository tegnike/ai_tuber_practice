/**
 * Copyright(c) Live2D Inc. All rights reserved.
 *
 * Use of this source code is governed by the Live2D Open Software license
 * that can be found at https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html.
 */

import { LAppModel } from './lappmodel';

/**
 * 発話クラス。
 */
export class LAppSpeak {
  /**
   * 音声を再生し、リップシンクを行う
   */
  public async speak(buffer: ArrayBuffer) {
    await new Promise((resolve) => {
      this.playFromArrayBuffer(buffer, () => {
        resolve(true);
      });
    });
  }

  public async playFromArrayBuffer(buffer: ArrayBuffer, onEnded?: () => void) {
    const audio: AudioContext = new AudioContext();
    const analyser: AnalyserNode = audio.createAnalyser();

    const audioBuffer = await audio.decodeAudioData(buffer);

    const bufferSource = audio.createBufferSource();
    bufferSource.buffer = audioBuffer;

    bufferSource.connect(audio.destination);
    bufferSource.connect(analyser);
    bufferSource.start();
    if (onEnded) {
      bufferSource.addEventListener("ended", onEnded);
    }
  }
}
