import { setTimeout } from 'timers/promises';
import got from 'got';

export const waitMesurementFinish = async (id: string) => {
	for (;;) {
		const response = await got(`http://localhost:3000/v1/measurements/${id}`);
		const body = JSON.parse(response.body);

		if (body.status !== 'in-progress') {
			return { response, body };
		}

		await setTimeout(500);
	}
};
