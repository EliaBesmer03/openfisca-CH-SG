install:
	uv run --locked pre-commit install

test:
	uv run openfisca test --country-package openfisca_ch_sg openfisca_ch_sg/tests

serve-local:
	uv run openfisca serve --country-package openfisca_ch_sg
