// Same-origin on purpose. The session cookie is scoped to .bee.geobon.org, so it
// rides along here without any CORS setup -- calling auth.bee.geobon.org directly
// would be cross-origin, get no Access-Control-Allow-Origin back, and send no
// cookie. The gateway proxies this one path through to the auth host.
const getUserInfo = async () => {
    return await fetch("/oauth2/userinfo", {
        credentials: "same-origin",
    })
}

export default getUserInfo;
