# WHO ICD API Setup Guide

This guide explains how to obtain your **Client ID** and **Client Secret** from the World Health Organization (WHO) ICD API portal and configure them for this project.

## Prerequisites

- A valid email address for registration.

## Step-by-Step Instructions

### 1. Register for an Account
1. Visit the [WHO ICD API Home Page](https://icd.who.int/icdapi).
2. Click on **Register** in the top navigation bar.
3. Fill out the required information to create your account.
4. Verify your email if requested.

### 2. Log In
1. Return to [https://icd.who.int/icdapi](https://icd.who.int/icdapi).
2. Click **Log in** and enter your credentials.

### 3. Access API Keys
1. Once logged in, look for the **API Access** section on the home page or dashboard.
2. Click on the link that says **View API access key(s)**.
   - *Note: You may be redirected to a localized version of the site (e.g., https://icd.who.int/browse11/l-m/en).*
3. On the API keys page, you will see two important values generated for your account:
   - **Client ID**
   - **Client Secret**

### 4. Configure Your Project
1. Open the file `db/keys.ts` in your project.
2. Update the `credentials` object with your values:

```typescript:db/keys.ts
export const credentials = {
    // Replace with your actual Client ID
    apiKey: "YOUR_CLIENT_ID", 
    
    // Replace with your actual Client Secret
    apiSecret: "YOUR_CLIENT_SECRET",
}

export const apiUrl = "https://icdaccessmanagement.who.int/connect/token";
```

## Important Notes

- **Security:** Never commit your actual `keys.ts` file with real credentials to a public repository. Add `db/keys.ts` to your `.gitignore` if you plan to share this code.
- **Token Endpoint:** The authentication URL is strictly `https://icdaccessmanagement.who.int/connect/token`.
- **Documentation:** For more technical details, refer to the [official API Documentation](https://icd.who.int/icdapi/docs2/).
