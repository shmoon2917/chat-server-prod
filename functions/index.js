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

// application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({extended: true}));

// application/json
app.use(bodyParser.json());

app.use(cors({origin: true}));

const service = google.youtube("v3");

const oauth2Client = new google.auth.OAuth2("", "", "");

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

const getPlayLists = async () => {
  try {
    // console.time("get playlists");
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

      // console.timeEnd("get playlists");
      return hvoLists;
    } else {
      // console.timeEnd("get playlists");
      return null;
    }
  } catch (e) {
    // console.timeEnd("get playlists");
    throw e;
  }
};

const getPlayListItems = async (query) => {
  try {
    // console.time("get playlistItems");
    const {data, status} = await service.playlistItems.list(query);

    if (status === 200) {
      // console.timeEnd("get playlistItems");
      return data;
    } else {
      // console.timeEnd("get playlistItems");
      return null;
    }
  } catch (e) {
    // console.timeEnd("get playlistItems");
    throw e;
  }
};

const addPlayList = async (hvoListsLength) => {
  try {
    // console.time("insert playlist");
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
      // console.timeEnd("insert list");
      return response.data;
    } else {
      // console.timeEnd("insert list");
      return null;
    }
  } catch (e) {
    // console.timeEnd("insert list");
    throw e;
  }
};

app.post("/api/playlistItem", async (req, res) => {
  if (!req.body.videoId) {
    return res.status(400).json({success: false});
  }

  const videoId = req.body.videoId;

  try {
    const hvoLists = await getPlayLists();

    if (hvoLists === null) {
      return res.status(400).json({
        success: false,
      });
    }
    let latestHvoList = {
      id: hvoLists[0].id,
      title: hvoLists[0].snippet.title,
      description: hvoLists[0].snippet.description,
    };

    const hvoItemsData = await getPlayListItems({
      part: "id",
      playlistId: latestHvoList.id,
      fields: "pageInfo",
      maxResults: 1,
    });

    if (hvoItemsData === null) {
      return res.status(400).json({
        success: false,
      });
    }

    if (hvoItemsData.pageInfo.totalResults >= 200) {
      const {id, snippet} = await addPlayList(hvoLists.length);
      latestHvoList.id = id;
      latestHvoList.title = snippet.title;
      latestHvoList.description = snippet.description;
    }

    // console.time("insert playlistItem");
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
      // console.timeEnd("insert playlistItem");
      return res.status(200).json({
        success: true,
        data: {
          playlist: {
            ...latestHvoList,
          },
          video: {
            id: data.videoId,
            title: data.snippet.title,
            // description: data.snippet.description,
            thumbnailUrl: data.snippet.thumbnails.default.url,
          },
        },
      });
    } else {
      // console.timeEnd("insert playlistItem");
      return res.status(400).json({
        success: false,
      });
    }
  } catch (e) {
    // console.timeEnd("insert playlistItem");
    console.log("The API returned a error : " + e);
    return res.status(400).json({
      success: false,
      error: e,
    });
  }
});

app.get("/api/playListItem", async (req, res) => {
  const isRandom = req.query.random;
  try {
    const hvoLists = await getPlayLists();
    if (isRandom === "true") {
      const listRandomIndex = Math.floor(Math.random() * hvoLists.length);
      const selectedHvoList = hvoLists[listRandomIndex];

      let keep = true,
        first = true,
        hvoItemsLength = 0,
        itemRandomIndex = 0,
        randomHvoItem = null,
        npt = "";

      while (keep) {
        let hvoItemsData = await getPlayListItems({
          part: "id",
          playlistId: selectedHvoList.id,
          fields: "pageInfo, items(id), nextPageToken",
          maxResults: 50,
          pageToken: npt ? npt : "",
        });

        if (first) {
          hvoItemsLength = hvoItemsData.pageInfo.totalResults;
          itemRandomIndex = Math.floor(Math.random() * hvoItemsLength);
        }

        if (itemRandomIndex >= 50) {
          itemRandomIndex -= 50;
          npt = hvoItemsData.nextPageToken;
          first = false;
        } else {
          randomHvoId = hvoItemsData.items[itemRandomIndex].id;
          keep = false;
        }
      }

      if (randomHvoId) {
        const randomHvoItemDetail = await getPlayListItems({
          part: "id, snippet",
          id: randomHvoId,
          fields: "items(id,snippet(title,resourceId(videoId)))",
        });

        if (randomHvoItemDetail.items[0]) {
          return res.status(200).json({
            success: true,
            data: {
              playlist: selectedHvoList,
              playlistItem: {
                id: randomHvoItemDetail.items[0].snippet.resourceId.videoId,
                title: randomHvoItemDetail.items[0].snippet.title,
              },
            },
          });
        } else {
          return res.status(400).json({
            success: false,
            message: "에러 발생",
          });
        }
      } else {
        return res.status(400).json({
          success: false,
          message: "에러 발생",
        });
      }
    } else {
      return res.status(200).json({
        success: false,
        message: "아직 구현 하지 않음",
      });
    }
  } catch (e) {
    console.log("The API returned a error : " + e);
    return res.status(400).json({
      success: false,
      error: e,
    });
  }
});

exports.app = functions.https.onRequest(app);
