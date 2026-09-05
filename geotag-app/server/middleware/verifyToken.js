const jwt = require('jsonwebtoken');
const { isTokenDenylisted } = require('../utils/tokenDenylist');

/*
When designing JWT auth:
You know almost every protected resource will need the identity of the logged-in user.
Rather than manually checking token + decoding in every route, you do it once in middleware.
Then req.userId becomes a trusted, convenient handle to reference the user in all downstream route handlers.
Storing userId in req is the standard way to give routes access to authenticated user info. hence req.userId=decoded.id
 */

// CSRF fix (audit finding BE-002) — nothing to forge on a read, so only mutating
// methods require the matching header below.
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const verifyToken=(req,res,next)=>{
    const token=req.cookies.token;//req.cookies.token-reads the token that was stored in the browser cookie during login/signup
    if(!token){
        return res.status(401).json({message:'No token provided, unauthorized'});
    }

    // Audit finding BE-015: pin the accepted algorithm explicitly rather than relying
    // on jsonwebtoken's own default allow-list — jsonwebtoken 9.x's defaults already
    // block the classic "alg:none"/algorithm-confusion bypass, so this is defense in
    // depth, not a fix for a demonstrated vulnerability. Every token this app issues is
    // signed with HS256 (see routes/authRoutes.js's jwt.sign calls); nothing else
    // should ever be accepted here.
    jwt.verify(token,process.env.JWT_SECRET,{ algorithms: ['HS256'] },async (err,decoded)=>{
        //#region
        /*
        401 Unauthorized → Means “you are not authenticated” — i.e., no valid credentials were provided.
        Example: user didn’t send a token at all (req.cookies.token missing).

        403 Forbidden → Means “you are authenticated, but not allowed” — i.e., the credentials exist but are invalid or you don’t have permission.
        Example: token exists but is invalid, expired, or tampered with (jwt.verify fails).
         */
        //#endregion
        if (err) return res.status(403).json({ message: 'Invalid token' });

        // Audit finding BE-013: a logged-out token's jti is denylisted for its
        // remaining lifetime (see routes/authRoutes.js's /logout and
        // utils/tokenDenylist.js) — reject it here the same way an invalid signature
        // is rejected, before it ever reaches req.userId.
        if (await isTokenDenylisted(decoded.jti, req.log)) {
            return res.status(403).json({ message: 'Token has been revoked' });
        }

        /*
        CSRF fix (BE-002). decoded.csrf is the value issued alongside THIS exact JWT at
        login/signup/google-auth time (see authRoutes.js's createToken/generateCsrfToken)
        and handed to the real client exactly once, in that response's JSON BODY — never
        in a cookie, since a cookie set by this API's origin can never be read by
        frontend JS running on a different origin anyway (the classic double-submit-
        cookie pattern doesn't actually work across the cross-origin Vercel/Render split
        this app runs on). A cross-site request forged via a plain HTML form still gets
        the httpOnly auth cookie attached automatically by the browser — that was never
        preventable — but a plain form cannot set a custom header at all, so it can never
        supply a matching X-CSRF-Token. Only script actually running on the real
        frontend, which read this value from its own login response, can.

        A token issued before this fix shipped has no `csrf` claim at all — decoded.csrf
        is falsy for it. That's deliberately treated as a mismatch (fails CLOSED), not as
        "nothing to compare against, let it through": an old session must log in again to
        receive a token that carries the claim, rather than this check silently doing
        nothing for anyone still holding a pre-fix token.
        */
        if (!SAFE_METHODS.has(req.method)) {
            const headerToken = req.headers['x-csrf-token'];
            if (!decoded.csrf || headerToken !== decoded.csrf) {
                return res.status(403).json({ message: 'Invalid or missing CSRF token' });
            }
        }

        //decoded contains the payload we signed (e.g., { id: userId, iat: timestamp, exp: timestamp })
        req.userId=decoded.id;//middleware adds userId to req object and sends only the id from authenticated user
        /*
        If the token is valid, take the id from the token payload and store it in req.userId.
        This is now available in any route that uses this middleware
         */
        next();//token is valid,proceed to next middleware or route handler
    });
};
module.exports = verifyToken;