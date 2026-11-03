/**
 * Server utilities bridge for @tanstack/react-start/server
 */
export function getRequest() {
  return {
    headers: new Headers({
      authorization: "Bearer tg-native-admin-token",
    }),
    url: typeof window !== "undefined" ? window.location.href : "http://localhost:3000",
  };
}

export function getCookie(_name: string) {
  return null;
}

export default {
  getRequest,
  getCookie,
};
