# Fix Publish 403 Error

## Step 1: Redeploy
```
cd admin
npx wrangler deploy
```
Try Publish again. If still 403, continue:

## Step 2: Use a Classic GitHub Token
Fine-grained tokens can be tricky. Use a classic one instead:

1. Go to: https://github.com/settings/tokens
2. Click "Generate new token" -> "Generate new token (classic)"
3. Check the "repo" checkbox (full control of private repositories)
4. Click "Generate token" at the bottom
5. Copy the token

## Step 3: Update the secret
```
cd admin
npx wrangler secret put GITHUB_TOKEN
```
Paste the classic token when prompted, press Enter.

## Step 4: Redeploy again
```
cd admin
npx wrangler deploy
```

## Step 5: Try Publish in the dashboard

## IMPORTANT
Make sure the token is created under the Henkey123321 account, NOT TJKDev1.
