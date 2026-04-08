let resetAfterFailure = false;

export const setResetAfterFailure = () => {
	resetAfterFailure = true;
};

export const consumeResetAfterFailure = () => {
	if (!resetAfterFailure) {
		return false;
	}

	resetAfterFailure = false;
	return true;
};

