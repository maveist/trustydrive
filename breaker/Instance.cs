using System;
using System.Collections.Generic;
using System.IO;
using System.Runtime.Serialization.Json;
using System.Text;
using System.Threading.Tasks;
using Windows.Networking;
using Windows.Networking.Sockets;
using Windows.Storage;
using Windows.Storage.Streams;
using Windows.Web.Http;

namespace breaker
{
    public sealed class Chunk
    {
        public string name { get; set; }
        public string id { get; set; }
    }

    public sealed class DownloadedChunk
    {
        public uint size { get; }
        public string name { get; }
        public DataReader reader { get; }

        public DownloadedChunk(IBuffer buffer, string chunkname)
        {
            reader = DataReader.FromBuffer(buffer);
            size = buffer.Length;
            name = chunkname;
        }

        public byte readByte()
        {
            return reader.ReadByte();
        }

        public void close()
        {
            reader.Dispose();
        }
    }

    public sealed class Instance
    {
        // Store downloaded data from chunk downloads
        private DownloadedChunk[] _downloads;

        private bool _downloaded = false;
        public bool Downloaded
        {
            get { return _downloaded; }
        }

        // Answer of dispatcher requests
        private IList<string> _answer = new List<string>();
        public IList<string> Answer
        {
            get { return _answer; }
        }

        // Result of both chunk uploads and chunk downloads
        private IList<string> _result;
        public IList<string> Result
        {
            get { return _result; }
        }

        public async void createChunks(IList<string> chunkNameList, IList<string> chunkIdList,
            IList<string> providerNameList, IList<string> providerTokenList, IList<string> cloudFolderList,
            IRandomAccessStream readStream, uint maxChunkSize)
        {
            try
            {
                // Store the result of chunk uploads
                _result = new List<string>();
                // Convert lists to arrays
                string[] chunkNames = new string[chunkNameList.Count];
                chunkNameList.CopyTo(chunkNames, 0);
                string[] chunkIds = new string[chunkIdList.Count];
                chunkIdList.CopyTo(chunkIds, 0);
                string[] providerNames = new string[providerNameList.Count];
                providerNameList.CopyTo(providerNames, 0);
                string[] providerTokens = new string[providerTokenList.Count];
                providerTokenList.CopyTo(providerTokens, 0);
                string[] cloudFolders = new string[cloudFolderList.Count];
                cloudFolderList.CopyTo(cloudFolders, 0);
                // Number of bytes read from the readStream
                ulong nbread = 0;
                uint nbProviders = (uint)providerNames.Length;
                int chunkIdx = 0;
                using (IInputStream inputStream = readStream.GetInputStreamAt(0))
                {
                    using (var dataReader = new DataReader(inputStream))
                    {
                        while (nbread < readStream.Size)
                        {
                            DataWriter[] chunkWriters = new DataWriter[nbProviders];
                            for (int i = 0; i < nbProviders; i++)
                            {
                                chunkWriters[i] = new DataWriter();
                            }
                            uint nbloaded = await dataReader.LoadAsync(nbProviders * maxChunkSize);
                            byte[] temp = new byte[nbloaded];
                            // Fill buffers with data
                            dataReader.ReadBytes(temp);
                            for (int i = 0; i < nbloaded; i++)
                            {
                                if (i < nbProviders && providerNames[i % nbProviders] == "gdrive" && chunkIds[chunkIdx + i % nbProviders] == "none")
                                {
                                    // Starts the multipart data for new Google Drive chunks
                                    chunkWriters[i % nbProviders].WriteString("--trustydrive_separator\nContent-Type: application/json; charset=UTF-8\n\n"
                                        + "{\n\"name\": \"" + chunkNames[chunkIdx + i % nbProviders] + "\",\n\"parents\": [ \"" + cloudFolders[i % nbProviders]
                                        + "\" ]\n}\n\n--trustydrive_separator\nContent-Type: application/octet-stream\n\n");
                                    StorageFile log = await ApplicationData.Current.LocalFolder.CreateFileAsync("log.txt", CreationCollisionOption.ReplaceExisting);
                                    await FileIO.WriteTextAsync(log, "idata: " + i + "/" + nbloaded);
                                }
                                chunkWriters[i % nbProviders].WriteByte(temp[i]);
                                if (i + nbProviders >= nbloaded && providerNames[i % nbProviders] == "gdrive" && chunkIds[chunkIdx + i % nbProviders] == "none")
                                {
                                    // Ends with the multipart separator for new Google Drive chunks
                                    chunkWriters[i % nbProviders].WriteString("\n--trustydrive_separator--");
                                }
                            }
                            for (int i = 0; i < nbProviders; i++)
                            {
                                uploadAsync(providerNames[i], providerTokens[i], cloudFolders[i], chunkNames[chunkIdx], chunkIds[chunkIdx++], chunkWriters[i].DetachBuffer());
                                chunkWriters[i].Dispose();
                                if (chunkIdx > 0 && chunkIdx % 10 == 0)
                                {
                                    await Task.Delay(TimeSpan.FromSeconds(1));
                                }
                            }
                            nbread += nbloaded;
                        }
                    }
                }
                readStream.Dispose();
            }
            catch (Exception e)
            {
                StorageFile log = await ApplicationData.Current.LocalFolder.CreateFileAsync("log.txt", CreationCollisionOption.ReplaceExisting);
                await FileIO.WriteTextAsync(log, "error from the encoding process: " + e);
            }
        }

        private async void uploadAsync(string providerName, string token, string cloudFolder, string chunkName, string chunkId, IBuffer data)
        {
            try
            {
                HttpClient client = new HttpClient();
                String uri = "toBeFilled";
                HttpRequestMessage message;
                HttpResponseMessage response;
                switch (providerName)
                {
                    case "dropbox":
                        uri = "https://content.dropboxapi.com/1/files_put/auto/trustydrive/" + chunkName;
                        message = new HttpRequestMessage(HttpMethod.Put, new Uri(uri));
                        message.Headers.Append("Authorization", "Bearer " + token);
                        message.Content = new HttpBufferContent(data);
                        break;
                    case "onedrive":
                        uri = "https://api.onedrive.com/v1.0/drive/items/" + cloudFolder + ":/" + chunkName + ":/content?select=id";
                        message = new HttpRequestMessage(HttpMethod.Put, new Uri(uri));
                        message.Headers.Append("Authorization", "Bearer " + token);
                        message.Content = new HttpBufferContent(data);
                        message.Content.Headers.Append("Content-Type", "application/octet-stream");
                        break;
                    case "gdrive":
                        if (chunkId == "none")
                        {

                            uri = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart";
                            message = new HttpRequestMessage(HttpMethod.Post, new Uri(uri));
                        }
                        else
                        {
                            uri = "https://www.googleapis.com/upload/drive/v3/files/" + chunkId + "?uploadType=media";
                            message = new HttpRequestMessage(HttpMethod.Patch, new Uri(uri));
                        }
                        message.Headers.Append("Authorization", "Bearer " + token);
                        message.Content = new HttpBufferContent(data);
                        message.Content.Headers.Append("Content-Type", "multipart/related; boundary=trustydrive_separator");
                        break;
                    default:
                        // Never used, just for the compilation
                        message = new HttpRequestMessage();
                        break;
                }
                response = await client.SendRequestAsync(message);
                response.EnsureSuccessStatusCode();
                DataContractJsonSerializer jsonSerializer = new DataContractJsonSerializer(typeof(Chunk));
                Chunk ch = (Chunk)jsonSerializer.ReadObject(WindowsRuntimeStreamExtensions.AsStreamForRead(await response.Content.ReadAsInputStreamAsync()));
                if (providerName == "dropbox")
                {
                    _result.Add(chunkName);
                }
                else
                {
                    _result.Add(ch.name + ":$$:" + ch.id);
                }
            }
            catch (Exception e)
            {
                StorageFile log = await ApplicationData.Current.LocalFolder.CreateFileAsync("log.txt", CreationCollisionOption.ReplaceExisting);
                await FileIO.WriteTextAsync(log, "error from the upload process: " + e);
            }
        }

        public async void downloadFile(StorageFolder folder, string filename, IList<string> chunkNameList, IList<string> chunkIdList,
            IList<string> providerNameList, IList<string> providerTokenList, IList<string> cloudFolderList)
        {
            // Store the result of chunk downloads
            _result = new List<string>();
            // Convert lists to arrays
            string[] chunkNames = new string[chunkNameList.Count];
            chunkNameList.CopyTo(chunkNames, 0);
            string[] chunkIds = new string[chunkIdList.Count];
            chunkIdList.CopyTo(chunkIds, 0);
            string[] providerNames = new string[providerNameList.Count];
            providerNameList.CopyTo(providerNames, 0);
            string[] providerTokens = new string[providerTokenList.Count];
            providerTokenList.CopyTo(providerTokens, 0);
            string[] cloudFolders = new string[cloudFolderList.Count];
            cloudFolderList.CopyTo(cloudFolders, 0);
            int chunkIdx = 0;
            try
            {
                // Open the file
                StorageFile file = await folder.CreateFileAsync(filename, CreationCollisionOption.ReplaceExisting);
                IRandomAccessStream stream = await file.OpenAsync(FileAccessMode.ReadWrite);
                DataWriter writer = new DataWriter(stream.GetOutputStreamAt(0));
                int currentResult;
                while (chunkIdx < chunkNames.Length)
                {
                    currentResult = _result.Count;
                    _downloads = new DownloadedChunk[providerNames.Length];
                    for (int i = 0; i < providerNames.Length; i++, chunkIdx++)
                    {
                        switch (providerNames[i])
                        {
                            case "dropbox":
                            case "onedrive":
                                downloadAsync(chunkNames[chunkIdx], providerNames[i], providerTokens[i], cloudFolders[i], i);
                                break;
                            case "gdrive":
                                downloadAsync(chunkIds[chunkIdx], providerNames[i], providerTokens[i], cloudFolders[i], i);
                                break;
                        }
                    }
                    while (_result.Count < currentResult + providerNames.Length)
                    {
                        await Task.Delay(TimeSpan.FromMilliseconds(300));
                    }
                    for (int i = 0; i < _downloads[0].size; i++)
                    {
                        for (int j = 0; j < providerNames.Length; j++)
                        {
                            if (i < _downloads[j].size)
                            {
                                writer.WriteByte(_downloads[j].readByte());
                            }
                        }
                    }
                    for (int i = 0; i < providerNames.Length; i++)
                    {
                        _downloads[i].close();
                    }
                }
                await writer.StoreAsync();
                await writer.FlushAsync();
                writer.Dispose();
                stream.Dispose();
                _downloaded = true;
            }
            catch (Exception e)
            {
                StorageFile log = await ApplicationData.Current.LocalFolder.CreateFileAsync("log.txt", CreationCollisionOption.ReplaceExisting);
                await FileIO.WriteTextAsync(log, "error from the downloading process: " + e);
            }
        }

        public async void downloadAsync(string chunkName, string providerName, string providerToken, string cloudFolder, int downloadIdx)
        {
            try
            {
                HttpClient client = new HttpClient();
                string uri = "ToBeFilled";
                switch (providerName)
                {
                    case "dropbox":
                        uri = "https://content.dropboxapi.com/1/files/auto/" + cloudFolder + "/" + chunkName;
                        break;
                    case "gdrive":
                        uri = "https://www.googleapis.com/drive/v3/files/" + chunkName + "?alt=media";
                        break;
                    case "onedrive":
                        uri = "https://api.onedrive.com/v1.0/drive/items/" + cloudFolder + ":/" + chunkName + ":/content";
                        break;
                }
                HttpRequestMessage message = new HttpRequestMessage(HttpMethod.Get, new Uri(uri));
                message.Headers.Append("Authorization", "Bearer " + providerToken);
                HttpResponseMessage response = await client.SendRequestAsync(message);
                response.EnsureSuccessStatusCode();
                IBuffer buffer = await response.Content.ReadAsBufferAsync();
                _downloads[downloadIdx] = new DownloadedChunk(buffer, chunkName);
                _result.Add(chunkName);
            }
            catch (Exception e)
            {
                StorageFile log = await ApplicationData.Current.LocalFolder.CreateFileAsync("log.txt", CreationCollisionOption.ReplaceExisting);
                await FileIO.WriteTextAsync(log, "error from the downnload async: " + e);
            }
        }

        public async void dispatcher(string message)
        {
            try
            {
                StreamSocket socket = new StreamSocket();
                socket.Control.KeepAlive = true;
                HostName host = new HostName("localhost");
                await socket.ConnectAsync(host, "8989");
                Stream streamOut = socket.OutputStream.AsStreamForWrite();
                Stream streamIn = socket.InputStream.AsStreamForRead();
                StreamWriter writer = new StreamWriter(streamOut);
                StreamReader reader = new StreamReader(streamIn);
                string request = "hello:";
                await writer.WriteLineAsync(request);
                await writer.FlushAsync();
                string reply = await reader.ReadLineAsync();
                _answer.Add(reply);
            }
            catch (Exception e)
            {
                StorageFile log = await ApplicationData.Current.LocalFolder.CreateFileAsync("log.txt", CreationCollisionOption.ReplaceExisting);
                await FileIO.WriteTextAsync(log, "error from the dispacther communication: " + e);
            }
        }
    }
}
