import Swal from "sweetalert2";

const commonOptions = {
    confirmButtonColor: "#0088cc",
    cancelButtonColor: "#64748b",
    buttonsStyling: true,
    customClass: {
        popup: "flowcheck-alert-popup",
        title: "flowcheck-alert-title",
        confirmButton: "flowcheck-alert-confirm",
        cancelButton: "flowcheck-alert-cancel",
    },
};

export const showSuccessAlert = async (
    title: string,
    text?: string
) => {
    await Swal.fire({
        ...commonOptions,
        icon: "success",
        title,
        text,
        timer: 1500,
        timerProgressBar: true,
        showConfirmButton: false,
    });
};

export const showErrorAlert = async (
    title: string,
    text?: string
) => {
    await Swal.fire({
        ...commonOptions,
        icon: "error",
        title,
        text,
        confirmButtonText: "확인",
    });
};

export const showWarningAlert = async (
    title: string,
    text?: string
) => {
    await Swal.fire({
        ...commonOptions,
        icon: "warning",
        title,
        text,
        confirmButtonText: "확인",
    });
};

export const showInfoAlert = async (
    title: string,
    text?: string
) => {
    await Swal.fire({
        ...commonOptions,
        icon: "info",
        title,
        text,
        confirmButtonText: "확인",
    });
};

export const showConfirmAlert = async ({
    title,
    text,
    confirmText = "확인",
    cancelText = "취소",
    danger = false,
}: {
    title: string;
    text?: string;
    confirmText?: string;
    cancelText?: string;
    danger?: boolean;
}) => {
    const result = await Swal.fire({
        ...commonOptions,
        icon: "warning",
        title,
        text,
        showCancelButton: true,
        confirmButtonText: confirmText,
        cancelButtonText: cancelText,
        confirmButtonColor: danger ? "#ef4444" : "#0088cc",
        reverseButtons: true,
        focusCancel: true,
    });

    return result.isConfirmed;
};

export const showToast = (
    title: string,
    icon: "success" | "error" | "warning" | "info" = "success"
) => {
    return Swal.fire({
        toast: true,
        position: "top-end",
        icon,
        title,
        showConfirmButton: false,
        timer: 1800,
        timerProgressBar: true,
    });
};