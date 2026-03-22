"""
OCI Object Storage client (S3-compatible).
"""
import boto3
from botocore.config import Config as BotoConfig

from api.config import get_settings

_s3_client = None


def _get_s3_client():
    global _s3_client
    if _s3_client is not None:
        return _s3_client

    settings = get_settings()
    endpoint_url = (
        f"https://{settings.oci_namespace}.compat.objectstorage"
        f".{settings.oci_region}.oraclecloud.com"
    )
    _s3_client = boto3.client(
        "s3",
        region_name=settings.oci_region,
        endpoint_url=endpoint_url,
        aws_access_key_id=settings.oci_access_key,
        aws_secret_access_key=settings.oci_secret_key,
        config=BotoConfig(s3={"addressing_style": "path"}),
    )
    return _s3_client


import io

def upload_file_to_oci(
    file_data: bytes,
    object_key: str,
    content_type: str = "application/octet-stream",
) -> str:
    """Upload bytes to OCI Object Storage and return the object key."""
    client = _get_s3_client()
    settings = get_settings()

    # 대용량 파일(50MB 이상) 전송 시 MissingContentLength 에러 회피를 위해
    # io.BytesIO로 래핑한 뒤 multipart 업로드가 자동 적용되는 upload_fileobj 사용
    file_obj = io.BytesIO(file_data)
    client.upload_fileobj(
        file_obj,
        settings.oci_bucket_name,
        object_key,
        ExtraArgs={"ContentType": content_type}
    )
    return object_key
