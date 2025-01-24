require('dotenv').config(); // .env 파일 로드
const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource } = require('@discordjs/voice');
const googleTTS = require('google-tts-api'); // TTS 라이브러리

// 봇 클라이언트 설정
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildVoiceStates],
});

// 봇 토큰 및 클라이언트 ID 불러오기
const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

if (!TOKEN || !CLIENT_ID) {
  console.error('봇 토큰 또는 클라이언트 ID가 설정되지 않았습니다. .env 파일을 확인하세요.');
  process.exit(1);
}

// 슬래시 명령어 등록
const commands = [
  {
    name: '사다리',
    description: '입력한 이름들을 랜덤 순위로 정합니다.',
    options: [
      {
        name: '참가자',
        type: 3, // 문자열
        description: '쉼표로 구분된 이름들 (예: 이름1,이름2,이름3)',
        required: true,
      },
    ],
  },
];

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    console.log('슬래시 명령어 등록 중...');
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log('슬래시 명령어가 성공적으로 등록되었습니다.');
  } catch (error) {
    console.error('슬래시 명령어 등록 중 오류 발생:', error);
  }
})();

// 봇이 준비되었을 때 실행
client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

// 슬래시 명령어 처리
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) return;

  if (interaction.commandName === '사다리') {
    const participants = interaction.options.getString('참가자');
    const args = participants.split(',').map((name) => name.trim());

    if (args.length < 2) {
      await interaction.reply('2명 이상의 이름을 쉼표로 구분해 입력해주세요. 예: 이름1,이름2,이름3');
      return;
    }

    // 입력받은 이름들을 섞고 순위 출력
    const shuffled = args.sort(() => Math.random() - 0.5);
    const rankings = shuffled.map((name, index) => `${index + 1}등: ${name}`); // '위' 대신 '등'으로 수정

    await interaction.reply(`랜덤 순위:\n${rankings.join('\n')}`);

    // 음성 채널로 연결 및 결과 출력
    const voiceChannel = interaction.member.voice.channel;
    if (!voiceChannel) {
      await interaction.followUp('음성 채널에 먼저 참여해주세요!');
      return;
    }

    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: interaction.guild.id,
      adapterCreator: interaction.guild.voiceAdapterCreator,
    });

    const audioPlayer = createAudioPlayer();
    connection.subscribe(audioPlayer);

    // TTS 음성 파일 생성
    const textToSpeak = `결과는: ${rankings.join(', ')}`; // "순위 결과는 다음과 같습니다." -> "결과는"으로 변경
    const ttsUrl = googleTTS.getAudioUrl(textToSpeak, {
      lang: 'ko',
      slow: false,
    });

    console.log('생성된 TTS URL:', ttsUrl);

    // TTS URL로 음성 리소스 생성
    const resource = createAudioResource(ttsUrl);

    // 음성 재생
    audioPlayer.play(resource);

    // 음성 종료 후 연결 해제
    audioPlayer.on('idle', () => {
      connection.destroy();
    });
  }
});

// 봇 메시지를 감지하고 음성 생성 (자기 자신이 보낸 메시지 처리)
client.on('messageCreate', async (message) => {
  // 봇이 보낸 메시지인지 확인
  if (message.author.bot && message.author.id === client.user.id) {
    const text = message.content;
    if (!text) return;

    // 음성 채널 확인 (메시지를 보낸 사용자가 음성 채널에 있는지 확인)
    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel) {
      console.log('음성 채널에 연결되지 않았습니다.');
      return;
    }

    // 음성 채널 연결
    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: message.guild.id,
      adapterCreator: message.guild.voiceAdapterCreator,
    });

    const audioPlayer = createAudioPlayer();
    connection.subscribe(audioPlayer);

    // TTS 음성 생성 (한국어)
    const ttsUrl = googleTTS.getAudioUrl(text, {
      lang: 'ko',
      slow: false,
    });

    // TTS URL로 음성 리소스 생성
    const resource = createAudioResource(ttsUrl);

    // 음성 재생
    audioPlayer.play(resource);

    // 음성 재생 후 연결 종료
    audioPlayer.on('idle', () => {
      connection.destroy();
    });
  }
});

// 봇 로그인
client.login(TOKEN).catch((err) => {
  console.error('로그인 중 오류 발생:', err);
});
