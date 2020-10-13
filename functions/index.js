const functions = require("firebase-functions");
const express = require("express");
const cors = require("cors");
const open = require("open");
const bodyParser = require("body-parser");
const app = express();
const {google} = require("googleapis");
const {
  existsRefreshTokenFile,
  readRefreshToken,
  saveRefreshTokenAsFile,
} = require("./utils");
const {clientId, clientSecret} = require("./config");

// application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({extended: true}));

// application/json
app.use(bodyParser.json());

app.use(cors({origin: true}));

const service = google.youtube("v3");

const oauth2Client = new google.auth.OAuth2(
  clientId,
  clientSecret,
  "https://testchat-292012.web.app/api/oauth2callback"
);

const scopes = [
  "https://www.googleapis.com/auth/youtube",
  "https://www.googleapis.com/auth/youtube.force-ssl",
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/youtubepartner",
];

//  OAuth 서버 url 받기
//  access_type: offline 이면 refresh token 을 같이 줌
//  refresh token 은 처음 한 번만 발급됨
const authorizeUrl = oauth2Client.generateAuthUrl({
  access_type: "offline",
  scope: scopes,
});
(async function () {
  try {
    const exists = await existsRefreshTokenFile();
    if (exists) {
      const refreshToken = await readRefreshToken();

      oauth2Client.setCredentials({
        refresh_token: refreshToken,
      });

      await oauth2Client.getAccessToken();

      google.options({
        auth: oauth2Client,
      });
    } else {
      const cp = await open(authorizeUrl, {wait: false});
      cp.unref();
    }
  } catch (e) {
    console.log("error occured", e);
  }
})();

app.get("/api/oauth2callback", async (req, res) => {
  try {
    const code = req.query.code;
    const {tokens} = await oauth2Client.getToken(code);

    refreshToken = tokens.refresh_token;

    if (refreshToken) {
      saveRefreshTokenAsFile(refreshToken);
    }

    oauth2Client.credentials = tokens;

    google.options({
      auth: oauth2Client,
    });

    return res.status(200).json({
      success: true,
    });
  } catch (e) {
    console.log("The API returned a error : " + e);
    return res.status(400).json({
      success: false,
    });
  }
});

app.get("/api/playlists", async (req, res) => {
  try {
    const {data, status} = await service.playlists.list({
      part: "id, snippet",
      channelId: "UCXiFDw7tbIrFCuuIF6389DA",
      fields: "items(id,snippet(title,description))",
      maxResults: 50,
    });

    if (status === 200) {
      return res.status(200).json({
        success: true,
        data,
      });
    } else {
      return res.status(400).json({
        success: false,
        data,
      });
    }
  } catch (e) {
    return res.status(400).json({
      success: false,
      error: e,
    });
  }
});

const getPlayLists = async () => {
  try {
    console.time("get playlists");
    const {data, status} = await service.playlists.list({
      part: "id, snippet",
      channelId: "UCUBQ25uOs-fbEb9gr4gtxcw",
      fields: "items(id,snippet(title,description))",
      maxResults: 50,
    });

    if (status === 200) {
      let hvoLists = [];
      if (data.items.length > 0) {
        const RegExp = /(House Vibes Only - vol.[0-9]+)/i;
        hvoLists = data.items.filter(
          (item) => !!RegExp.test(item.snippet.title)
        );
      }

      console.timeEnd("get playlists");
      return hvoLists;
    } else {
      console.timeEnd("get playlists");
      return null;
    }
  } catch (e) {
    console.timeEnd("get playlists & error occured");
    throw e;
  }
};

const getPlayListItems = async (playlistId) => {
  try {
    console.time("get playlistItem");
    const {data, status} = await service.playlistItems.list({
      part: "id",
      playlistId,
      fields: "pageInfo",
      maxResults: 1,
    });

    if (status === 200) {
      console.timeEnd("get playlistItem");
      return data.pageInfo.totalResults;
    } else {
      console.timeEnd("get playlistItem");
      return null;
    }
  } catch (e) {
    console.timeEnd("get playlistItem & error occured");
    throw e;
  }
};

const addPlayList = async (hvoListsLength) => {
  try {
    console.time("insert playlist");
    const response = await service.playlists.insert({
      part: "id, snippet, status",
      requestBody: {
        snippet: {
          title: `House Vibes Only - vol.${hvoListsLength + 1}`,
          description: `House Vibes Only - 하우스 음악 집단디깅 Mix ${
            hvoListsLength + 1
          } 입니다.\n\n오픈채팅방 입장은 주소창에 bit.ly/하우스음악채팅`,
        },
        status: {
          privacyStatus: "public",
        },
      },
    });
    if (response.status === 200) {
      console.timeEnd("insert list");
      return response.data;
    } else {
      return null;
    }
  } catch (e) {
    console.timeEnd("insert list & error occured");
    throw e;
  }
};

app.post("/api/playlistItems", async (req, res) => {
  if (!req.body.videoId) {
    return res.status(400).json({success: false});
  }

  const videoId = req.body.videoId;

  try {
    const hvoLists = await getPlayLists();
    let latestHvoList = {
      id: hvoLists[0].id,
      title: hvoLists[0].snippet.title,
      description: hvoLists[0].snippet.description,
    };

    let hvoItemsLength = await getPlayListItems(latestHvoList.id);
    if (hvoItemsLength >= 200) {
      const {id, snippet} = await addPlayList(hvoLists.length);
      latestHvoList.id = id;
      latestHvoList.title = snippet.title;
      latestHvoList.description = snippet.description;
      hvoItemsLength = 0;
    }

    console.time("insert playlistItem");
    const {status, data} = await service.playlistItems.insert({
      part: "id, snippet",
      requestBody: {
        snippet: {
          playlistId: latestHvoList.id,
          resourceId: {
            kind: "youtube#video",
            videoId,
          },
        },
      },
    });

    if (status === 200) {
      console.timeEnd("insert playlistItem");
      return res.status(200).json({
        success: true,
        data: {
          playlist: {
            ...latestHvoList,
            itemsLength: hvoItemsLength,
          },
          video: {
            id: videoId,
            title: data.snippet.title,
            thumbnailUrl: data.snippet.thumbnails.default.url,
          },
        },
      });
    } else {
      console.timeEnd("insert playlistItem");
      return res.status(400).json({
        success: false,
      });
    }
  } catch (e) {
    console.timeEnd("insert playlistItem & error occured");
    console.log("The API returned a error : " + e);
    return res.status(400).json({
      success: false,
      error: e,
    });
  }
});

exports.app = functions.https.onRequest(app);
