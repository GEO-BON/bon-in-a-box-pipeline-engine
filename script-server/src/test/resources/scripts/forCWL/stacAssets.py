
inputs = biab_inputs()

biab_output("asset_count", len(inputs["stac"] or []))
