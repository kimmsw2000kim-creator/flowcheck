import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL;

export const signup = async ({ email, password, nickname }) => {
    const response = await axios.post(`${API_URL}/api/auth/signup`, {
        email,
        password,
        nickname,
    });

    return response.data;
};

export const login = async ({ email, password }) => {
    const response = await axios.post(`${API_URL}/api/auth/login`, {
        email,
        password,
    });

    return response.data;
};