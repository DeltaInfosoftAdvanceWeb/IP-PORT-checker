
import { jwtVerify } from 'jose'

export function getAuthToken() {
    const cookies = document.cookie.split("; ");
    const authToken = cookies.find(cookie => cookie.startsWith("authToken="));
    console.log("COKEKEI",cookies)
    console.log(authToken)
    return authToken ? authToken.split("=")[1] : null;
}



 export function deleteAuthToken() {
    document.cookie = "authToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    console.log("AuthToken has been deleted");
}


export async function verifyAuthToken(token) {
    try {
        console.log('Token:', token)

        try {
            const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.NEXT_PUBLIC_JWT_SECRET))
            console.log(process.env.NEXT_PUBLIC_JWT_SECRET)
            return payload
        } catch (err) {
            console.error("Invalid or expired token:", err);
        }

    } catch (error) {
        console.error('Error verifying JWT:', error)
        return null
    }
}

