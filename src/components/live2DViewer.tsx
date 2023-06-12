import { useEffect } from 'react';
import { LAppDelegate } from '../lib/Live2D/Demo/src/lappdelegate';
import * as LAppDefine from '../lib/Live2D/Demo/src/lappdefine';

const Live2DViewer = () => {
  useEffect(() => {
    if (LAppDelegate.getInstance().initialize() === false) {
      return;
    }

    LAppDelegate.getInstance().run();

    return () => {
      // 必要に応じてリソースのクリーンアップを行います
    };
  }, []); 

  return (
    // 必要に応じてここに任意のJSXを追加します
    <div />
  )
}

export default Live2DViewer;
