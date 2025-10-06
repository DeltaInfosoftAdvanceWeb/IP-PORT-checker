import { firebaseAdmin } from './FirsBaseSettings';

export async function sendNotificationForTO(toId, FCM) {

    console.log("HIHI", toId, FCM)
    if (!FCM) {
        console.error('FCM token is missing or invalid');
        return;
    }

    try {

        if (typeof FCM !== 'string' || FCM.length < 100) {
            console.error('Invalid FCM token format:', FCM);
            return;
        }

        const message = {
            notification: {
                title: 'New Transfer Order',
                body: `A new Transfer Order (ID: ${toId}) has been created.`,
            },
            token: FCM,
            android: {
                priority: 'high',
            },
            apns: {
                payload: {
                    aps: {
                        contentAvailable: true,
                    },
                },
            },
        };

        console.log('Attempting to send notification with message:', JSON.stringify(message, null, 2));

        const response = await firebaseAdmin.messaging().send(message);
        console.log('Successfully sent message:', response);
        return response;
    } catch (error) {
        console.error('Error details:', {
            code: error?.errorInfo?.code,
            message: error?.errorInfo?.message,
            stack: error?.stack,
        });

        if (error?.errorInfo?.code === 'messaging/registration-token-not-registered') {
            console.log('FCM token is invalid or not registered. Token should be removed:', FCM);
        }

        throw error;
    }
}
export async function sendNotificationForPO(PoId, FCM) {
    if (!FCM) {
        console.error('FCM token is missing or invalid');
        return;
    }

    try {

        if (typeof FCM !== 'string' || FCM.length < 100) {
            console.error('Invalid FCM token format:', FCM);
            return;
        }

        const message = {
            notification: {
                title: 'New Production Order',
                body: `A new Production Order (ID: ${PoId}) has been created.`,
            },
            token: FCM,
            android: {
                priority: 'high',
            },
            apns: {
                payload: {
                    aps: {
                        contentAvailable: true,
                    },
                },
            },
        };

        console.log('Attempting to send notification with message:', JSON.stringify(message, null, 2));

        const response = await firebaseAdmin.messaging().send(message);
        console.log('Successfully sent message:', response);
        return response;
    } catch (error) {
        console.error('Error details:', {
            code: error?.errorInfo?.code,
            message: error?.errorInfo?.message,
            stack: error?.stack,
        });

        if (error?.errorInfo?.code === 'messaging/registration-token-not-registered') {
            console.log('FCM token is invalid or not registered. Token should be removed:', FCM);
        }

        throw error;
    }
}

