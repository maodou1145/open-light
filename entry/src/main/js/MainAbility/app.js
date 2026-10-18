export default {
    onCreate() {
        if (canIUse("SystemCapability.ArkUI.ArkUI.Full")) {
            console.info('OR跑马灯 App onCreate');
        } else {
            // Fallback for unsupported SystemCapability
        }
    },
    onDestroy() {
        if (canIUse("SystemCapability.ArkUI.ArkUI.Full")) {
            console.info('OR跑马灯 App onDestroy');
        } else {
            // Fallback for unsupported SystemCapability
        }
    }
};