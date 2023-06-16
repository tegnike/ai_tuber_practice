/**
 * Copyright(c) Live2D Inc. All rights reserved.
 *
 * Use of this source code is governed by the Live2D Open Software license
 * that can be found at https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html.
 */

import { LAppLive2DManager } from './lapplive2dmanager';
import { CubismViewMatrix } from '@framework/math/cubismviewmatrix';

/**
 * 発話クラス。
 */
export class LAppSpeak {
  /**
   * 音声を再生し、リップシンクを行う
   */
  public async speak(buffer: ArrayBuffer) {
    const live2DManager: LAppLive2DManager = LAppLive2DManager.getInstance();
    this._viewMatrix = new CubismViewMatrix();
    live2DManager.setViewMatrix(this._viewMatrix);
    live2DManager.onUpdate();

    // リップシンクの開始
    live2DManager.onSpeak(buffer);

    // 音声の再生
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
  
  _viewMatrix: CubismViewMatrix; // viewMatrix
}
