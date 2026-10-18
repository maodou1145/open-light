export default {
    onCreate() {
        if (canIUse("SystemCapability.ArkUI.ArkUI.Full")) {
            console.info('Open Light App onCreate');
        } else {
            // Fallback for unsupported SystemCapability
        }
    },
    onDestroy() {
        if (canIUse("SystemCapability.ArkUI.ArkUI.Full")) {
            console.info('Open Light App onDestroy');
        } else {
            // Fallback for unsupported SystemCapability
        }
    }
};