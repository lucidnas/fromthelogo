const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error("GEMINI_API_KEY is not set. Bun should load it from .env.");
}

const model = process.env.VEO_MODEL ?? "veo-3.1-fast-generate-preview";
const outDir = process.env.VEO_OUT_DIR ?? "output/thats-what-she-said-veo-laugh";
const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predictLongRunning`;
const batch = process.env.VEO_BATCH ?? "base";

const promptBatches = {
  base: [
  {
    slug: "storm-pressure",
    prompt: `A satirical local TV weather broadcast in a glossy blue storm-tracker studio. Two anchors sit behind a glass desk. The meteorologist points at a massive storm graphic and says, "The pressure kept building until the whole system exploded overnight." The co-anchor slowly turns to camera and says, "That's what she said." Beat. Both anchors immediately break character and laugh out loud for the final two seconds; one leans back in the chair, the other covers their mouth. Include clear audible studio laughter. Realistic broadcast lighting, awkward pause, expressive reactions, viral meme clip energy, 16:9.`,
  },
  {
    slug: "rocket-launch",
    prompt: `A fake local news science segment in a bright professional studio. A female anchor holds up a model rocket and says, "Engineers say it launched early, but still reached an impressive height." The male anchor blinks, tries to stay professional, then says, "That's what she said." Beat. Both anchors burst into genuine laughter; the male anchor snorts slightly while the female anchor laughs and lowers the rocket. Include clear audible laughter for the final two seconds. Glossy studio set, realistic news anchors, deadpan comedy, clean 16:9 frame.`,
  },
  {
    slug: "pastry-firmed-up",
    prompt: `A parody morning show cooking segment in a bright studio kitchen. A chef proudly presents an oversized pastry while the host says, "It was soft at first, but after a few minutes in the oven it firmed up perfectly." The co-host immediately looks into camera and says, "That's what she said." Beat. The chef and both hosts break into loud laughter, one host bends forward laughing and taps the counter. Include audible laughter and a small off-camera crew chuckle for the final two seconds. Polished TV lighting, awkward comedic timing, viral clip style, 16:9.`,
  },
  {
    slug: "full-court-pressure",
    prompt: `A realistic fake TV news sports desk scene. Two anchors sit in front of a dramatic basketball graphic. The sports anchor says, "She thought she could handle the full court pressure, but it came at her way faster than expected." The co-anchor pauses, smirks, and says, "That's what she said." Beat. Both anchors lose composure and laugh out loud; the sports anchor looks down at the desk while laughing, the co-anchor laughs toward camera. Include clear audible laughter for the final two seconds. Professional broadcast studio, expressive but believable reactions, 16:9.`,
  },
  {
    slug: "charging-cable",
    prompt: `A satirical local news technology segment. A male anchor holds a giant charging cable and says, "The problem is, you have to plug it in at just the right angle or nothing happens." The female anchor stares silently for one beat, then says, "That's what she said." Beat. The male anchor tries to keep a straight face but fails, both anchors laugh loudly and naturally for the final two seconds. Include audible laughter, not just smiles. Modern TV studio, crisp lighting, deadpan comedy, realistic anchors, 16:9.`,
  },
],
  extra: [
    {
      slug: "garden-hose",
      prompt: `A satirical local morning show gardening segment on a bright TV studio set with plants and a demo table. A male host struggles with a tangled green garden hose and says, "I pulled as hard as I could, but it just kept spraying everywhere." The female co-host freezes, looks directly at the camera, and says, "That's what she said." Beat. Both hosts burst into loud laughter; the male host drops the hose and wipes tears from his eyes. Include clear audible laughter for the final two seconds. Realistic broadcast lighting, awkward comedic timing, viral meme clip energy, 16:9.`,
    },
    {
      slug: "fishing-rod",
      prompt: `A fake local news outdoor report inside a polished studio, with a giant screen showing a fisherman and a huge fishing rod. The anchor points to the screen and says, "He said it bent hard, fought him for ten minutes, then finally came up." The co-anchor pauses, smiles, and says, "That's what she said." Beat. Both anchors break character and laugh naturally; one anchor turns away from the camera while laughing. Include audible studio laughter for the final two seconds. Realistic news broadcast look, expressive reactions, 16:9.`,
    },
    {
      slug: "printer-jam",
      prompt: `A satirical local news technology help segment in a modern TV studio. A female anchor stands beside an oversized office printer prop and says, "The technician told us not to force it, just wait until it slides out on its own." The male anchor stares blankly for one beat, then says, "That's what she said." Beat. Both anchors lose composure and laugh out loud; the female anchor covers her face with the papers. Include clear audible laughter and a small off-camera crew chuckle for the final two seconds. Crisp studio lighting, realistic anchors, viral clip style, 16:9.`,
    },
  ],
} as const;

const prompts = promptBatches[batch as keyof typeof promptBatches];
if (!prompts) {
  throw new Error(`Unknown VEO_BATCH "${batch}". Use one of: ${Object.keys(promptBatches).join(", ")}`);
}

const parameters = {
  aspectRatio: "16:9",
  durationSeconds: 8,
  personGeneration: "allow_all",
  negativePrompt:
    "cartoon, animation, low quality, distorted faces, extra fingers, misspelled captions, real TV network logo, watermark",
};

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return JSON.parse(text);
}

async function getJson(url: string) {
  const res = await fetch(url, { headers: { "x-goog-api-key": apiKey } });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return JSON.parse(text);
}

function operationUrl(name: string) {
  return `https://generativelanguage.googleapis.com/v1beta/${name}`;
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function downloadGeneratedVideo(video: any, outPath: string) {
  if (video?.videoBytes) {
    await Bun.write(outPath, Buffer.from(video.videoBytes, "base64"));
    return true;
  }

  const uri = video?.uri ?? video?.video?.uri;
  if (uri) {
    const res = await fetch(uri, { headers: { "x-goog-api-key": apiKey } });
    if (!res.ok) {
      throw new Error(`download HTTP ${res.status}: ${await res.text()}`);
    }
    await Bun.write(outPath, await res.arrayBuffer());
    return true;
  }

  return false;
}

async function main() {
  await Bun.$`mkdir -p ${outDir}`;
  await Bun.write(
    `${outDir}/prompts.json`,
    JSON.stringify({ model, batch, parameters, prompts }, null, 2)
  );

  for (const [index, item] of prompts.entries()) {
    console.log(`\n[${index + 1}/${prompts.length}] Submitting ${item.slug}`);
    let operation = await postJson(endpoint, {
      instances: [{ prompt: item.prompt }],
      parameters,
    });

    await Bun.write(`${outDir}/${item.slug}.operation.start.json`, JSON.stringify(operation, null, 2));
    console.log(`Operation: ${operation.name}`);

    while (!operation.done) {
      await sleep(10000);
      operation = await getJson(operationUrl(operation.name));
      console.log(`${item.slug}: ${operation.done ? "done" : "waiting"}`);
    }

    await Bun.write(`${outDir}/${item.slug}.operation.done.json`, JSON.stringify(operation, null, 2));

    if (operation.error) {
      console.error(`${item.slug} failed: ${JSON.stringify(operation.error)}`);
      continue;
    }

    const generated =
      operation.response?.generatedVideos?.[0]?.video ??
      operation.response?.generated_videos?.[0]?.video ??
      operation.response?.generateVideoResponse?.generatedSamples?.[0]?.video;

    const outPath = `${outDir}/${String(index + 1).padStart(2, "0")}-${item.slug}.mp4`;
    const saved = await downloadGeneratedVideo(generated, outPath);
    if (saved) {
      console.log(`Saved ${outPath}`);
    } else {
      console.log(`No downloadable video field found for ${item.slug}; inspect the done JSON.`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
